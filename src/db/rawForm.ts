import { query } from "./client";

export async function insertRawForm(sessionId: string, applicationReference: string, payload: unknown): Promise<void> {
	await query(`INSERT INTO raw_form (session_id, application_reference, payload) VALUES ($1, $2, $3)`, [
		sessionId,
		applicationReference,
		payload,
	]);
}

export async function getRawFormBySessionId(sessionId: string): Promise<unknown | undefined> {
	const rows = await query<{ payload: unknown }>("SELECT payload FROM raw_form WHERE session_id = $1", [sessionId]);
	return rows[0]?.payload;
}
