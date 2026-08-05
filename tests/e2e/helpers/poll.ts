export type PollOptions = {
	timeoutMs?: number;
	intervalMs?: number;
};

export async function waitFor<T>(fetchFn: () => Promise<T>, predicate: (result: T) => boolean, options: PollOptions = {}): Promise<T> {
	const { timeoutMs = 10000, intervalMs = 250 } = options;
	const deadline = Date.now() + timeoutMs;

	while (true) {
		const result = await fetchFn();
		if (predicate(result)) {
			return result;
		}
		if (Date.now() >= deadline) {
			throw new Error(`waitFor timed out after ${timeoutMs}ms`);
		}
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
}
