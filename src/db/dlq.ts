import { query } from "./client";

export type DlqStage = "ingestion" | "email";

export type DlqEntry = {
	applicationReference: string;
	sessionId?: string;
	stage: DlqStage;
	retryable: boolean;
	reason: string;
	payload: Record<string, unknown>;
};

type DlqRow = {
	application_reference: string;
	session_id: string | null;
	stage: string;
	retryable: boolean;
	reason: string;
	payload: Record<string, unknown>;
};

function toApiShape(row: DlqRow): DlqEntry {
	return {
		applicationReference: row.application_reference,
		sessionId: row.session_id ?? undefined,
		stage: row.stage as DlqStage,
		retryable: row.retryable,
		reason: row.reason,
		payload: row.payload,
	};
}

// A fresh failure for the same application_reference replaces the previous DLQ entry -
// each form has at most one outstanding, actionable failure at a time.
export async function writeDlqEntry(entry: DlqEntry): Promise<void> {
	await query(
		`INSERT INTO dlq (application_reference, session_id, stage, retryable, reason, payload, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, now())
		 ON CONFLICT (application_reference) DO UPDATE SET
			session_id = EXCLUDED.session_id,
			stage = EXCLUDED.stage,
			retryable = EXCLUDED.retryable,
			reason = EXCLUDED.reason,
			payload = EXCLUDED.payload,
			updated_at = now()`,
		[entry.applicationReference, entry.sessionId ?? null, entry.stage, entry.retryable, entry.reason, entry.payload]
	);
}

export async function getDlqEntry(applicationReference: string): Promise<DlqEntry | undefined> {
	const rows = await query<DlqRow>("SELECT * FROM dlq WHERE application_reference = $1", [applicationReference]);
	return rows[0] ? toApiShape(rows[0]) : undefined;
}

export async function deleteDlqEntry(applicationReference: string): Promise<void> {
	await query("DELETE FROM dlq WHERE application_reference = $1", [applicationReference]);
}
