import { Pool } from "pg";

export async function up(databaseUrl: string): Promise<void> {
	const pool = new Pool({ connectionString: databaseUrl });
	try {
		await pool.query(`
			CREATE TABLE IF NOT EXISTS raw_form (
				id SERIAL PRIMARY KEY,
				session_id TEXT NOT NULL UNIQUE,
				application_reference TEXT NOT NULL,
				payload JSONB NOT NULL,
				received_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);
		`);
	} finally {
		await pool.end();
	}
}
