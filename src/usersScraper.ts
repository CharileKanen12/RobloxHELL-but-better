const MAX_SEARCH_FRIENDS_LIMIT = 50;
const MAX_HTTP_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30_000;

function backoffMs(attempt: number) {
	return Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** attempt);
}

function wait(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

type FriendResponse = {
	PreviousCursor: null | string;
	PageItems: {
		id: number;
		hasVerifiedBadge: boolean;
	}[];
	NextCursor: string | null;
	HasMore: null;
};

function generateURL(userId: string, cursor?: string | null): string {
	if (!cursor)
		return `https://friends.roblox.com/v1/users/${userId}/friends/search?limit=${MAX_SEARCH_FRIENDS_LIMIT}`;
	return `https://friends.roblox.com/v1/users/${userId}/friends/search?limit=${MAX_SEARCH_FRIENDS_LIMIT}&cursor=${cursor}`;
}

async function fetchFriendsPage(
	userId: string,
	cursor: string | null
): Promise<FriendResponse> {
	for (let attempt = 0; ; attempt++) {
		let resp: Response;
		try {
			resp = await fetch(generateURL(userId, cursor), {
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
					`Network error fetching friends of ${userId}: ${
						(err as Error).message
					}`
				);
			}
			const waitMs = backoffMs(retryAttempt);
			console.warn(
				`Network error fetching friends of ${userId}, retrying in ${Math.round(
					waitMs / 1000
				)}s (attempt ${retryAttempt})`
			);
			await wait(waitMs);
			continue;
		}

		if (resp.ok) {
			return (await resp.json()) as FriendResponse;
		}

		const retryAttempt = attempt + 1;
		const waitMs = backoffMs(retryAttempt);
		console.warn(
			`HTTP ${resp.status} fetching friends of ${userId}, retrying in ${Math.round(
				waitMs / 1000
			)}s (attempt ${retryAttempt})`
		);
		if (retryAttempt >= MAX_HTTP_RETRIES) {
			throw new Error(
				`HTTP ${resp.status} error fetching friends of ${userId}`
			);
		}
		await wait(waitMs);
	}
}

export async function* streamFriends(
	userid: string
): AsyncGenerator<number> {
	yield Number(userid);

	let nextCursor: string | null = null;
	let hasMore = true;

	while (hasMore) {
		const data = await fetchFriendsPage(userid, nextCursor);
		for (const entry of data.PageItems) {
			yield entry.id;
		}

		nextCursor = data.NextCursor;
		hasMore = !!nextCursor;
	}
}

/** Get ALL FRIENDS of a Roblox user. */
export async function getFriends(userid: string): Promise<number[]> {
	const friends: number[] = [];
	for await (const id of streamFriends(userid)) {
		friends.push(id);
	}
	return friends;
}
