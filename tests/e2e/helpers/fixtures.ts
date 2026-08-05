import { randomUUID } from "crypto";
import personOne from "../../../src/forms/examples/person_one.json";
import personTwo from "../../../src/forms/examples/person_two.json";
import personThree from "../../../src/forms/examples/person_three.json";

export const fixtures = { personOne, personTwo, personThree };

export function buildForm<T extends Record<string, unknown>>(base: T, overrides: Record<string, unknown> = {}) {
	return {
		...base,
		session_id: randomUUID(),
		application_reference: `GRU-${Math.floor(Math.random() * 1_000_000)}-2026`,
		...overrides,
	};
}
