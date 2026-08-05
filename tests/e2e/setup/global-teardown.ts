export default async function globalTeardown(): Promise<void> {
	const container = global.__PG_CONTAINER__;
	if (container) {
		await container.stop();
	}
}
