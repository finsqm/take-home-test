import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";

declare global {
	var __PG_CONTAINER__: StartedPostgreSqlContainer | undefined;
}

export default async function globalSetup(): Promise<void> {
	if (process.env.TEST_DATABASE_URL) {
		process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
	} else {
		const container = await new PostgreSqlContainer("postgres:16-alpine").start();
		global.__PG_CONTAINER__ = container;
		process.env.DATABASE_URL = container.getConnectionUri();
	}

	// Implementation is expected to provide a migration entrypoint at src/db/migrate.
	// Until it exists, this throws Cannot find module at runtime — the intended first
	// red signal for the e2e suite. Using require() (not `import`) keeps this a runtime
	// failure rather than a `tsc`/build-time one, since the module doesn't exist yet.
	const { up } = require("../../../src/db/migrate") as { up: (databaseUrl: string) => Promise<void> };
	await up(process.env.DATABASE_URL);
}
