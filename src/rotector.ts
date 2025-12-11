import { sleep } from "bun";

const MAX_HTTP_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30_000;

function retryDelayMs(attempt: number) {
        return Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** (attempt - 1));
}

export interface Reason {
        message: string;
        confidence: number;
        evidence: string[] | null;
}

export interface Reviewer {
        username: string;
        displayName: string;
}

export interface UserStatus {
        id: number;
        flagType: number;
        confidence?: number;
        reasons?: Record<string, Reason>;
        reviewer?: Reviewer;
        engineVersion?: string;
        versionCompatibility?: string;
        lastUpdated?: number;
}

interface BatchRequest {
        ids: number[];
}

interface BatchApiResponse {
        success: boolean;
        data?: Record<string, UserStatus>;
        error?: string;
}

/* ------------------------------------------------------------ */
/*  UTILITY FUNCTIONS                                           */
/* ------------------------------------------------------------ */

export enum UserFlagStatus {
        /** Safe - No concerning patterns detected */
        SAFE = 0,
        /** Pending - User is queued for analysis */
        PENDING = 1,
        /** Unsafe - Violates platform safety guidelines */
        UNSAFE = 2,
        /** Queued - Submitted for review */
        QUEUED = 3,
        /** Integration - Related to API integration features */
        INTEGRATION = 4,
        /** Mixed - Contains both safe and unsafe signals */
        MIXED = 5,
        /** Past Offender - Previously flagged but status changed */
        PAST_OFFENDER = 6
}

export function flagTypeToEnum(f: number): UserFlagStatus {
        switch (f) {
                case 0:
                        return UserFlagStatus.SAFE;
                case 1:
                        return UserFlagStatus.PENDING;
                case 2:
                        return UserFlagStatus.UNSAFE;
                case 3:
                        return UserFlagStatus.QUEUED;
                case 4:
                        return UserFlagStatus.INTEGRATION;
                case 5:
                        return UserFlagStatus.MIXED;
                case 6:
                        return UserFlagStatus.PAST_OFFENDER;
                default:
                        throw new Error(`Unknown flag type: ${f}`);
        }
}

export function flagTypeToString(f: number): string {
        if (f in UserFlagStatus) {
                return UserFlagStatus[f] || "UNKNOWN";
        }
        return "UNKNOWN";
}

export function extractDiscordId(status: UserStatus): string | null {
        if (!status.reasons) return null;
        
        const discordIdRegex = /\b(\d{17,19})\b/g;
        
        for (const reason of Object.values(status.reasons)) {
                if (reason.evidence) {
                        for (const evidence of reason.evidence) {
                                const matches = evidence.match(discordIdRegex);
                                if (matches && matches.length > 0) {
                                        return matches[0];
                                }
                        }
                }
                const messageMatches = reason.message.match(discordIdRegex);
                if (messageMatches && messageMatches.length > 0) {
                        return messageMatches[0];
                }
        }
        
        return null;
}

/* ------------------------------------------------------------ */
/*  GLOBAL RATE-LIMIT GATE                                      */
/* ------------------------------------------------------------ */

let global429Lock: Promise<void> | null = null;

async function waitForGlobal429() {
        if (global429Lock) {
                await global429Lock;
        }
}

async function activateGlobal429(waitMs: number) {
        // Prevent overlapping locks
        if (!global429Lock) {
                global429Lock = (async () => {
                        console.warn(`rotector: GLOBAL 429 HALT for ${waitMs}ms`);
                        await sleep(waitMs);
                        global429Lock = null;
                        console.warn("rotector: GLOBAL 429 CLEARED");
                })();
        }

        await global429Lock;
}

/* ------------------------------------------------------------ */
/*  SINGLE BATCH REQUEST (429 SAFE)                             */
/* ------------------------------------------------------------ */

async function checkMultipleUsers(
        userIds: number[]
): Promise<Record<string, UserStatus>> {
        let consecutiveFailures = 0;

        while (true) {
                await waitForGlobal429();

                let response: Response;
                try {
                        response = await fetch(
                                "https://roscoe.robalyx.com/v1/lookup/roblox/user",
                                {
                                        method: "POST",
                                        headers: {
                                                "Content-Type": "application/json",
                                                "User-Agent":
                                                        "robloxHELL/1.0 (+https://ocbwoy3.dev, ocbwoy3@ocbwoy3.dev)"
                                        },
                                        body: JSON.stringify({ ids: userIds } as BatchRequest)
                                }
                        );
                } catch (err) {
                        consecutiveFailures++;
                        if (consecutiveFailures > MAX_HTTP_RETRIES) {
                                throw new Error(
                                        `Network error contacting Rotector: ${(err as Error).message}`
                                );
                        }
                        const waitMs = retryDelayMs(consecutiveFailures);
                        console.warn(
                                `rotector: network error, retrying batch in ${Math.round(
                                        waitMs / 1000
                                )}s (attempt ${consecutiveFailures})`
                        );
                        await sleep(waitMs);
                        continue;
                }

                if (response.ok) {
                        consecutiveFailures = 0;
                        const result = (await response.json()) as BatchApiResponse;

                        if (!result.success || !result.data) {
                                throw new Error(result.error || "Failed to fetch users data");
                        }

                        return result.data;
                }

                if (response.status === 429) {
                        consecutiveFailures = 0;
                        const retryAfter = Number(response.headers.get("Retry-After")) || 10;
                        const waitMs = retryAfter * 1000 + 2500;

                        // HALT all new batches + wait
                        await activateGlobal429(waitMs);
                        continue;
                }

                consecutiveFailures++;
                if (consecutiveFailures > MAX_HTTP_RETRIES) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                }

                const waitMs = retryDelayMs(consecutiveFailures);
                console.warn(
                        `rotector: HTTP ${response.status}, retrying batch in ${Math.round(
                                waitMs / 1000
                        )}s (attempt ${consecutiveFailures})`
                );
                await sleep(waitMs);
        }
}

/* ------------------------------------------------------------ */
/*  BATCH PROCESSOR                                             */
/* ------------------------------------------------------------ */

export async function checkLotsOfUsers(
        ids: number[]
): Promise<Record<string, UserStatus>> {
        const userStatuses: Record<string, UserStatus> = {};

        const BATCH_SIZE = 50;
        const START_DELAY_MS = 150;

        // Create batches
        const batches: number[][] = [];
        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
                batches.push(ids.slice(i, i + BATCH_SIZE));
        }

        const runningTasks: Promise<void>[] = [];

        for (let i = 0; i < batches.length; i++) {
                // Wait for stagger timing
                if (i !== 0 && (i%25)===1) {
                        await sleep(START_DELAY_MS);
                }

                await waitForGlobal429();

                // console.log(`rotector: launching batch ${i + 1}/${batches.length}`);

                const task = checkMultipleUsers(batches[i]!)
                        .then((data) => {
                                Object.assign(userStatuses, data);
                        })
                        .catch((err) => {
                                // console.error(`Batch ${i + 1} failed:`, err);
                        });

                runningTasks.push(task);
        }

        await Promise.all(runningTasks);

        return userStatuses;
}
