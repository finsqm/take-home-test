import request from "supertest";
import app from "../../src/app";
import { lookupPostcode } from "../../src/providers/idealpostcodes";
import { sendEmail } from "../../src/providers/sendgrid";
import { fixtures, buildForm } from "./helpers/fixtures";
import { waitFor } from "./helpers/poll";

const mockLookupPostcode = lookupPostcode as jest.MockedFunction<typeof lookupPostcode>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

describe("provider failures route to a retryable DLQ", () => {
	it("routes to a retryable DLQ entry when geocoding fails", async () => {
		mockLookupPostcode.mockResolvedValueOnce({ statusCode: 500, body: undefined });

		const form = buildForm(fixtures.personOne);
		await request(app).post("/ingest").send(form).expect(202);

		const dlqEntry = await waitFor(
			() => request(app).get(`/dlq/${form.application_reference}`),
			(res) => res.status === 200
		);

		expect(dlqEntry.body).toMatchObject({ retryable: true });

		const stored = await request(app).get(`/forms/${form.application_reference}`);
		expect(stored.status).toBe(404);
	});

	it("routes to a retryable DLQ entry when sending the confirmation email fails", async () => {
		mockSendEmail.mockResolvedValueOnce({ statusCode: 500, body: undefined });

		const form = buildForm(fixtures.personOne);
		await request(app).post("/ingest").send(form).expect(202);

		const dlqEntry = await waitFor(
			() => request(app).get(`/dlq/${form.application_reference}`),
			(res) => res.status === 200
		);

		expect(dlqEntry.body).toMatchObject({ retryable: true });
	});
});
