import { Pool, PoolClient, QueryResultRow } from "pg";
import { withSpan } from "../tracer";

let pool: Pool | undefined;

function getPool(): Pool {
    if (!pool) {
        pool = new Pool({ connectionString: process.env.DATABASE_URL });
        pool.on("error", (err) => console.error("pg pool error", err));
    }
    return pool;
}

export async function closePool(): Promise<void> {
    if (pool) {
        const current = pool;
        pool = undefined;
        await current.end();
    }
}

// Whatever query() runs against - the pool (the default) or a single checked-out client,
// e.g. from withTransaction(), when a caller needs several statements to commit atomically.
export type Executor = { query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<{ rows: T[] }> };

export async function query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
    executor: Executor = getPool()
): Promise<T[]> {
    // Span attribute is the SQL text only (placeholders like $1, not the bound values,
    // which may contain PII such as email/DOB) - safe to export to a trace backend.
    return withSpan("db.query", { "db.system": "postgresql", "db.statement": text }, async () => {
        const result = await executor.query<T>(text, params);
        return result.rows;
    });
}

// Runs fn against a single dedicated client inside one Postgres transaction, committing
// only if fn resolves. Lets a caller pass the client on to both query() (its optional
// executor param) and pg-boss's send() (its `db` option, via pgBossExecutor) so a job
// enqueue can be made durable in the exact same transaction as the DB write that triggered
// it - a transactional outbox, using pg-boss's own job table as the outbox rather than a
// bespoke one.
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await getPool().connect();
    try {
        await client.query("BEGIN");
        try {
            const result = await fn(client);
            await client.query("COMMIT");
            return result;
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        }
    } finally {
        client.release();
    }
}

// Adapts a pg client to the minimal { executeSql } shape pg-boss's SendOptions.db expects,
// so a job insert (see withTransaction above) runs on that client instead of pg-boss's own pool.
export function pgBossExecutor(client: PoolClient): { executeSql(text: string, values: unknown[]): Promise<{ rows: unknown[] }> } {
    return { executeSql: (text, values) => client.query(text, values) };
}

export async function withAdvisoryLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const client = await getPool().connect();
    try {
        await client.query("SELECT pg_advisory_lock(hashtext($1))", [key]);
        try {
            return await fn();
        } finally {
            await client.query("SELECT pg_advisory_unlock(hashtext($1))", [key]);
        }
    } finally {
        client.release();
    }
}
