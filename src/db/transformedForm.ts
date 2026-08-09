import { query, Executor } from "./client";

type TransformedFormRow = {
	session_id: string;
	application_reference: string;
	first_name: string;
	last_name: string;
	email: string;
	gender: string;
	date_of_birth: string;
	phone_number: string | null;
	mobile_number: string;
	address_line_1: string;
	address_line_2: string;
	address_line_3: string | null;
	postcode: string;
	country: string;
	longitude: number;
	latitude: number;
};

function toApiShape(row: TransformedFormRow): TransformedFormSchema {
	return {
		sessionId: row.session_id,
		applicationReference: row.application_reference,
		firstName: row.first_name,
		lastName: row.last_name,
		email: row.email,
		gender: row.gender as TransformedFormSchema["gender"],
		dateOfBirth: new Date(row.date_of_birth),
		phoneNumber: row.phone_number ?? undefined,
		mobileNumber: row.mobile_number,
		addressLine1: row.address_line_1,
		addressLine2: row.address_line_2,
		addressLine3: row.address_line_3 ?? undefined,
		postcode: row.postcode,
		country: row.country,
		longitude: Number(row.longitude),
		latitude: Number(row.latitude),
	};
}

export async function findTransformedForm(applicationReference: string): Promise<TransformedFormSchema | undefined> {
	const rows = await query<TransformedFormRow>("SELECT * FROM transformed_form WHERE application_reference = $1", [
		applicationReference,
	]);
	return rows[0] ? toApiShape(rows[0]) : undefined;
}

// Returns whether a row was actually inserted (false on a conflicting application_reference) -
// callers use this to avoid double-triggering side effects like the confirmation email
// under the rare race the advisory lock isn't already guarding against.
export async function insertTransformedForm(form: TransformedFormSchema, executor?: Executor): Promise<boolean> {
	const rows = await query<{ id: number }>(
		`INSERT INTO transformed_form (
			session_id, application_reference, first_name, last_name, email, gender,
			date_of_birth, phone_number, mobile_number, address_line_1, address_line_2,
			address_line_3, postcode, country, longitude, latitude
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		ON CONFLICT (application_reference) DO NOTHING
		RETURNING id`,
		[
			form.sessionId,
			form.applicationReference,
			form.firstName,
			form.lastName,
			form.email,
			form.gender,
			form.dateOfBirth.toISOString().slice(0, 10),
			form.phoneNumber ?? null,
			form.mobileNumber,
			form.addressLine1,
			form.addressLine2,
			form.addressLine3 ?? null,
			form.postcode,
			form.country,
			form.longitude,
			form.latitude,
		],
		executor
	);
	return rows.length > 0;
}
