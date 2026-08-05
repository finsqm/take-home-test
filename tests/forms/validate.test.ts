import { validateIngestedForm } from "../../src/forms/validate";
import personOne from "../../src/forms/examples/person_one.json";
import personTwo from "../../src/forms/examples/person_two.json";
import personThree from "../../src/forms/examples/person_three.json";

describe("validateIngestedForm", () => {
	it("accepts a fully populated form", () => {
		const result = validateIngestedForm(personOne);
		expect(result.success).toBe(true);
	});

	it("accepts a form missing the optional address_line_3", () => {
		const result = validateIngestedForm(personTwo);
		expect(result.success).toBe(true);
	});

	it("accepts a form missing the optional phone_number", () => {
		const result = validateIngestedForm(personThree);
		expect(result.success).toBe(true);
	});

	it("rejects a form with an out-of-enum gender (schema drift)", () => {
		const result = validateIngestedForm({ ...personOne, gender: "unspecified" });
		expect(result.success).toBe(false);
	});

	it("rejects a form missing a required field entirely", () => {
		const { email, ...withoutEmail } = personOne as Record<string, unknown>;
		const result = validateIngestedForm(withoutEmail);
		expect(result.success).toBe(false);
	});

	it("rejects a form with a malformed date_of_birth", () => {
		const result = validateIngestedForm({ ...personOne, date_of_birth: "01/01/1990" });
		expect(result.success).toBe(false);
	});

	it("rejects a non-object payload", () => {
		const result = validateIngestedForm("not a form");
		expect(result.success).toBe(false);
	});

	it("returns a human-readable reason on failure", () => {
		const result = validateIngestedForm({ ...personOne, gender: "unspecified" });
		if (result.success) throw new Error("expected validation to fail");
		expect(result.reason).toContain("gender");
	});
});
