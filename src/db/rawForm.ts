import { query } from "./client";

export type RawFormRecord = {
	payload: unknown;
	// The W3C traceparent captured from the /ingest request that wrote this row - stored so
	// the ingestion consumer (running later, on pg-boss's polling loop, with no HTTP request
	// context of its own) can re-link its trace back to the original request, even across a
	// /retry that happens long after the original request's span has ended.
	traceContext?: string;
};

export async function insertRawForm(
	sessionId: string,
	applicationReference: string,
	payload: unknown,
	traceContext: string | undefined
): Promise<void> {
	await query(
		`INSERT INTO raw_form (session_id, application_reference, payload, trace_context) VALUES ($1, $2, $3, $4)`,
		[sessionId, applicationReference, payload, traceContext ?? null]
	);
}

export async function getRawFormBySessionId(sessionId: string): Promise<RawFormRecord | undefined> {
	const rows = await query<{ payload: unknown; trace_context: string | null }>(
		"SELECT payload, trace_context FROM raw_form WHERE session_id = $1",
		[sessionId]
	);
	const row = rows[0];
	return row ? { payload: row.payload, traceContext: row.trace_context ?? undefined } : undefined;
}
