import { query } from "./client";

export async function getRawFormBySessionId(sessionId: string): Promise<unknown | undefined> {
	const rows = await query<{ payload: unknown }>("SELECT payload FROM raw_form WHERE session_id = $1", [sessionId]);
	return rows[0]?.payload;
}
