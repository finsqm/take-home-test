import request from "supertest";
import app from "../../src/app";
import { lookupPostcode } from "../../src/providers/idealpostcodes";
import { sendEmail } from "../../src/providers/sendgrid";
import { fixtures, buildForm } from "./helpers/fixtures";
import { waitFor } from "./helpers/poll";

const mockLookupPostcode = lookupPostcode as jest.MockedFunction<typeof lookupPostcode>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

describe("POST /retry/:applicationReference", () => {
	it("succeeds once retried after the transient failure clears, without losing the original data", async () => {
		mockLookupPostcode.mockResolvedValueOnce({ statusCode: 500, body: undefined });

		const form = buildForm(fixtures.personOne);
		await request(app).post("/ingest").send(form).expect(202);

		await waitFor(
			() => request(app).get(`/dlq/${form.application_reference}`),
			(res) => res.status === 200 && res.body.retryable === true
		);

		// The mock's default beforeEach reset means the next call to lookupPostcode
		// succeeds, simulating "the transient provider blip has cleared / a code fix
		// was deployed" ahead of the retry.
		const retryResponse = await request(app).post(`/retry/${form.application_reference}`);
		expect(retryResponse.status).toBe(202);

		const stored = await waitFor(
			() => request(app).get(`/forms/${form.application_reference}`),
			(res) => res.status === 200
		);

		expect(stored.body).toMatchObject({
			applicationReference: form.application_reference,
			firstName: "John",
			lastName: "Doe",
			email: form.email,
			addressLine1: form.address.address_line_1,
			postcode: form.address.postcode,
			longitude: 50.05,
			latitude: -5.05,
		});
		expect(mockSendEmail).toHaveBeenCalledTimes(1);
	});
});
