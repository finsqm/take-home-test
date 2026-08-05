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

			CREATE TABLE IF NOT EXISTS transformed_form (
				id SERIAL PRIMARY KEY,
				session_id TEXT NOT NULL,
				application_reference TEXT NOT NULL UNIQUE,
				first_name TEXT NOT NULL,
				last_name TEXT NOT NULL,
				email TEXT NOT NULL,
				gender TEXT NOT NULL,
				date_of_birth TEXT NOT NULL,
				phone_number TEXT,
				mobile_number TEXT NOT NULL,
				address_line_1 TEXT NOT NULL,
				address_line_2 TEXT NOT NULL,
				address_line_3 TEXT,
				postcode TEXT NOT NULL,
				country TEXT NOT NULL,
				longitude DOUBLE PRECISION NOT NULL,
				latitude DOUBLE PRECISION NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);

			CREATE TABLE IF NOT EXISTS dlq (
				id SERIAL PRIMARY KEY,
				application_reference TEXT NOT NULL UNIQUE,
				session_id TEXT,
				stage TEXT NOT NULL,
				retryable BOOLEAN NOT NULL,
				reason TEXT NOT NULL,
				payload JSONB NOT NULL,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			);
		`);
	} finally {
		await pool.end();
	}
}
