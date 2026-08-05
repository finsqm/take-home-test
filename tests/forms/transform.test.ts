import { transformForm } from "../../src/forms/transform";
import personOne from "../../src/forms/examples/person_one.json";
import personTwo from "../../src/forms/examples/person_two.json";

const geo = { longitude: 50.05, latitude: -5.05 };

describe("transformForm", () => {
	it("splits a two-word name into firstName/lastName", () => {
		const result = transformForm(personOne as IngestedFormSchema, geo);
		expect(result.firstName).toBe("John");
		expect(result.lastName).toBe("Doe");
	});

	it("keeps the remainder of a multi-word name as lastName", () => {
		const result = transformForm(personTwo as IngestedFormSchema, geo);
		expect(result.firstName).toBe("Andy");
		expect(result.lastName).toBe("James Smith-Jones");
	});

	it('maps gender "other" to "prefer-not-to-say"', () => {
		const result = transformForm({ ...personOne, gender: "other" } as IngestedFormSchema, geo);
		expect(result.gender).toBe("prefer-not-to-say");
	});

	it("passes male/female gender through unchanged", () => {
		expect(transformForm(personOne as IngestedFormSchema, geo).gender).toBe("male");
	});

	it("parses date_of_birth into a Date matching the original calendar date", () => {
		const result = transformForm(personOne as IngestedFormSchema, geo);
		expect(result.dateOfBirth.toISOString().slice(0, 10)).toBe("1990-01-01");
	});

	it("carries the geocoded longitude/latitude onto the transformed form", () => {
		const result = transformForm(personOne as IngestedFormSchema, geo);
		expect(result.longitude).toBe(50.05);
		expect(result.latitude).toBe(-5.05);
	});

	it("leaves optional phone_number undefined when absent", () => {
		const { phone_number, ...withoutPhone } = personOne as Record<string, unknown>;
		const result = transformForm(withoutPhone as IngestedFormSchema, geo);
		expect(result.phoneNumber).toBeUndefined();
	});

	it("carries session_id and application_reference through unchanged", () => {
		const result = transformForm(personOne as IngestedFormSchema, geo);
		expect(result.sessionId).toBe(personOne.session_id);
		expect(result.applicationReference).toBe(personOne.application_reference);
	});
});
