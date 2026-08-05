import { z } from "zod";

const addressSchema = z.object({
	address_line_1: z.string().min(1),
	address_line_2: z.string().min(1),
	address_line_3: z.string().min(1).optional(),
	postcode: z.string().min(1),
	country: z.string().min(1),
});

const ingestedFormSchema = z.object({
	session_id: z.string().min(1),
	application_reference: z.string().min(1),
	name: z.string().min(1),
	email: z.string().email(),
	gender: z.enum(["male", "female", "other"]),
	date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date_of_birth must be in YYYY-MM-DD format"),
	phone_number: z.string().min(1).optional(),
	mobile_number: z.string().min(1),
	address: addressSchema,
});

export type ValidationResult =
	| { success: true; data: IngestedFormSchema }
	| { success: false; reason: string };

export function validateIngestedForm(raw: unknown): ValidationResult {
	const result = ingestedFormSchema.safeParse(raw);

	if (!result.success) {
		return { success: false, reason: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") };
	}

	return { success: true, data: result.data as IngestedFormSchema };
}
