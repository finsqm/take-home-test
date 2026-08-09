import "./telemetry";
import app from "./app";
import { up } from "./db/migrate";
import { startConsumers } from "./consumers";

const PORT = process.env.PORT || 3000;

async function main(): Promise<void> {
	await up(process.env.DATABASE_URL as string);

	// Started at boot, not lazily from the first /ingest request, so a restarted instance
	// whose first traffic happens to be a /retry (or nothing at all yet) still has workers
	// polling the queues.
	await startConsumers();

	app.listen(PORT, () => {
		console.log(`Server is running on http://localhost:${PORT}`);
	});
}

main().catch((err) => {
	console.error("Failed to start server", err);
	process.exit(1);
});
