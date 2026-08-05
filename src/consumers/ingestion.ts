import { withAdvisoryLock } from "../db/client";
import { getRawFormBySessionId } from "../db/rawForm";
import { findTransformedForm, insertTransformedForm } from "../db/transformedForm";
import { writeDlqEntry, deleteDlqEntry } from "../db/dlq";
import { validateIngestedForm } from "../forms/validate";
import { transformForm } from "../forms/transform";
import { lookupPostcode } from "../providers/idealpostcodes";
import { getBoss, EMAIL_QUEUE } from "../queue/boss";

export type IngestionJobData = {
	sessionId: string;
	applicationReference: string;
};

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

export async function processIngestionJob(data: IngestionJobData): Promise<void> {
	await withAdvisoryLock(data.applicationReference, () => processLocked(data));
}

async function processLocked(data: IngestionJobData): Promise<void> {
	const { sessionId, applicationReference } = data;

	// The 3rd party may redeliver the same application under a new session_id - once it
	// has been fully processed, later redeliveries are no-ops.
	const alreadyProcessed = await findTransformedForm(applicationReference);
	if (alreadyProcessed) {
		return;
	}

	let rawPayload: unknown;
	try {
		rawPayload = await getRawFormBySessionId(sessionId);
	} catch (err) {
		await dlq(data, true, `failed to load raw form: ${errorMessage(err)}`);
		return;
	}

	if (rawPayload === undefined) {
		await dlq(data, true, "no raw_form row found for this session_id");
		return;
	}

	const validation = validateIngestedForm(rawPayload);
	if (!validation.success) {
		await dlq(data, false, `schema validation failed: ${validation.reason}`);
		return;
	}

	const form = validation.data;

	let geo: { longitude: number; latitude: number };
	try {
		const geoResponse = await lookupPostcode(form.address.postcode);
		if (geoResponse.statusCode !== 200 || !geoResponse.body) {
			throw new Error(`geocoding provider returned status ${geoResponse.statusCode}`);
		}
		geo = geoResponse.body;
	} catch (err) {
		await dlq(data, true, `geocoding failed: ${errorMessage(err)}`);
		return;
	}

	const transformed = transformForm(form, geo);

	let inserted: boolean;
	try {
		inserted = await insertTransformedForm(transformed);
	} catch (err) {
		await dlq(data, true, `database write failed: ${errorMessage(err)}`);
		return;
	}

	await deleteDlqEntry(applicationReference);

	if (!inserted) {
		// Another delivery won the race to store this application_reference first.
		return;
	}

	const boss = await getBoss();
	await boss.send(EMAIL_QUEUE, {
		applicationReference,
		to: "happyforms@bots.com",
		from: "forms@take-home-test.example",
		subject: `New registration received: ${applicationReference}`,
		body: `A new registration form (${applicationReference}) has been successfully processed.`,
	});
}

async function dlq(data: IngestionJobData, retryable: boolean, reason: string): Promise<void> {
	await writeDlqEntry({
		applicationReference: data.applicationReference,
		sessionId: data.sessionId,
		stage: "ingestion",
		retryable,
		reason,
		payload: data,
	});
}
