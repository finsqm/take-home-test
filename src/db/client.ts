import { Pool, QueryResultRow } from "pg";

let pool: Pool | undefined;

function getPool(): Pool {
	if (!pool) {
		pool = new Pool({ connectionString: process.env.DATABASE_URL });
	}
	return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
	text: string,
	params?: unknown[]
): Promise<T[]> {
	const result = await getPool().query<T>(text, params);
	return result.rows;
}
