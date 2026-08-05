import { randomUUID } from "crypto";
import request from "supertest";
import app from "../../src/app";
import { lookupPostcode } from "../../src/providers/idealpostcodes";
import { sendEmail } from "../../src/providers/sendgrid";
import { fixtures, buildForm } from "./helpers/fixtures";
import { waitFor } from "./helpers/poll";

const mockLookupPostcode = lookupPostcode as jest.MockedFunction<typeof lookupPostcode>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

describe("duplicate delivery (the 3rd party does not guarantee exactly-once)", () => {
	it("processes a form once when redelivered with the same application_reference but a different session_id", async () => {
		const form = buildForm(fixtures.personOne);
		await request(app).post("/ingest").send(form).expect(202);

		const stored = await waitFor(
			() => request(app).get(`/forms/${form.application_reference}`),
			(res) => res.status === 200
		);

		const redelivered = { ...form, session_id: randomUUID() };
		const secondResponse = await request(app).post("/ingest").send(redelivered);
		expect(secondResponse.status).toBe(202);

		// Grace period past normal processing latency, to let any (incorrect) reprocessing
		// happen before asserting it didn't.
		await new Promise((resolve) => setTimeout(resolve, 3000));

		expect(mockLookupPostcode).toHaveBeenCalledTimes(1);
		expect(mockSendEmail).toHaveBeenCalledTimes(1);

		const restored = await request(app).get(`/forms/${form.application_reference}`);
		expect(restored.body).toEqual(stored.body);
	});
});
