import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { up } from "../../../src/db/migrate";

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

    await up(process.env.DATABASE_URL);
}
