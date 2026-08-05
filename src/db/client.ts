import { Pool, QueryResultRow } from "pg";
import { withSpan } from "../tracer";

let pool: Pool | undefined;

function getPool(): Pool {
	if (!pool) {
		pool = new Pool({ connectionString: process.env.DATABASE_URL });
		// pg.Pool requires an 'error' listener - without one, an idle client error (e.g. the
		// server terminating the connection, such as on container shutdown in tests) crashes
		// the whole process instead of just being reported.
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

export async function query<T extends QueryResultRow = QueryResultRow>(
	text: string,
	params?: unknown[]
): Promise<T[]> {
	// Span attribute is the SQL text only (placeholders like $1, not the bound values,
	// which may contain PII such as email/DOB) - safe to export to a trace backend.
	return withSpan("db.query", { "db.system": "postgresql", "db.statement": text }, async () => {
		const result = await getPool().query<T>(text, params);
		return result.rows;
	});
}

// Postgres advisory locks are session-scoped, so the lock/unlock pair must run on the
// same checked-out client rather than going through the pool's query() (which may hand
// out a different connection per call).
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
