const MAX_HTTP_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30_000;

function backoffMs(attempt: number) {
	return Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** attempt);
}

function wait(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

type RolesetInfo = {
	groupId: number;
	roles: {
		id: number;
		name: string;
		rank: number;
		memberCount: number;
	}[];
};

export type Roleset = RolesetInfo["roles"][number];

export interface GroupMemberEntry {
	userId: number;
	rolesetId: number;
}

type GroupMembersResponse = {
	previousPageCursor: string | null;
	nextPageCursor: string | null;
	data: {
		hasVerifiedBadge: boolean;
		userId: number;
		username: string;
		displayName: string;
	}[];
};

async function fetchJSON(url: string) {
	for (let attempt = 0; ; attempt++) {
		let resp: Response;
		try {
			resp = await fetch(url, {
				headers: {
					Accept: "application/json",
					"User-Agent":
						"robloxHELL/1.0 (+https://ocbwoy3.dev, ocbwoy3@ocbwoy3.dev)",
					Cookie: `.ROBLOSECURITY=${process.env.COOKIE}`
				}
			});
		} catch (err) {
			const retryAttempt = attempt + 1;
			if (retryAttempt >= MAX_HTTP_RETRIES) {
				throw new Error(
					`Network error fetching ${url}: ${(err as Error).message}`
				);
			}
			const waitMs = backoffMs(retryAttempt);
			console.warn(
				`Network error fetching ${url}, retrying in ${Math.round(
					waitMs / 1000
				)}s (attempt ${retryAttempt})`
			);
			await wait(waitMs);
			continue;
		}

		if (resp.ok) return await resp.json();

		const retryAttempt = attempt + 1;
		const retryAfterHeader = Number(resp.headers.get("Retry-After"));
		const waitMs =
			resp.status === 429 && !Number.isNaN(retryAfterHeader)
				? retryAfterHeader * 1000
				: backoffMs(retryAttempt);

		console.warn(
			`HTTP ${resp.status} fetching ${url}, retrying in ${Math.round(
				waitMs / 1000
			)}s (attempt ${retryAttempt})`
		);

		if (retryAttempt >= MAX_HTTP_RETRIES) {
			throw new Error(`HTTP ${resp.status} error fetching ${url}`);
		}

		await wait(waitMs);
	}
}

export async function getGroupRoles(groupId: string): Promise<Roleset[]> {
	const link = `https://groups.roblox.com/v1/groups/${groupId}/roles`;
	const rolesets = (await fetchJSON(link)) as RolesetInfo;
	return rolesets.roles.filter((r) => r.rank > 0);
}

export async function getRolesetIds(groupId: string): Promise<number[]> {
	const roles = await getGroupRoles(groupId);
	return roles.map((r) => r.id);
}

function generateURL(
	groupId: string,
	rolesetId: string,
	cursor?: string | null
): string {
	const base = `https://groups.roblox.com/v1/groups/${groupId}/roles/${rolesetId}/users?limit=100&sortOrder=Asc`;
	return cursor ? `${base}&cursor=${cursor}` : base;
}

async function* streamRolesetMembers(
	groupId: string,
	rolesetId: number
): AsyncGenerator<GroupMemberEntry> {
	let cursor: string | null = null;

	while (true) {
		const url = generateURL(groupId, `${rolesetId}`, cursor);
		const data = (await fetchJSON(url)) as GroupMembersResponse;

		for (const entry of data.data) {
			yield { userId: entry.userId, rolesetId };
		}

		if (!data.nextPageCursor) break;
		cursor = data.nextPageCursor;
	}
}

export async function* streamGroupMembers(
	groupId: string,
	max?: number,
	rolesets?: Roleset[]
): AsyncGenerator<GroupMemberEntry> {
	const roleList = rolesets ?? (await getGroupRoles(groupId));
	let delivered = 0;

	for (const roleset of roleList) {
		for await (const member of streamRolesetMembers(groupId, roleset.id)) {
			yield member;
			delivered++;

			if (max && delivered >= max) {
				return;
			}
		}
	}
}

/** Fetch all members of a group asynchronously */
export async function getGroupName(groupId: string): Promise<string> {
	const link = `https://groups.roblox.com/v1/groups/${groupId}`;
	const groupInfo = (await fetchJSON(link)) as { name: string };
	return groupInfo.name;
}

export async function getAllGroupMembers(
	groupId: string,
	max?: number
): Promise<number[]> {
	const allUsers: number[] = [];
	for await (const entry of streamGroupMembers(groupId, max)) {
		allUsers.push(entry.userId);
	}
	return allUsers;
}
