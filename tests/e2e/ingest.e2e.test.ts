import request from "supertest";
import app from "../../src/app";
import { lookupPostcode } from "../../src/providers/idealpostcodes";
import { fixtures, buildForm } from "./helpers/fixtures";
import { waitFor } from "./helpers/poll";

const mockLookupPostcode = lookupPostcode as jest.MockedFunction<typeof lookupPostcode>;

describe("POST /ingest -> transform pipeline", () => {
	it("accepts a valid form and responds 202 without waiting for processing", async () => {
		const form = buildForm(fixtures.personOne);

		const response = await request(app).post("/ingest").send(form);

		expect(response.status).toBe(202);
	});

	it("eventually stores the transformed form", async () => {
		const form = buildForm(fixtures.personOne);
		await request(app).post("/ingest").send(form).expect(202);

		const stored = await waitFor(
			() => request(app).get(`/forms/${form.application_reference}`),
			(res) => res.status === 200
		);

		expect(stored.body).toMatchObject({
			sessionId: form.session_id,
			applicationReference: form.application_reference,
			firstName: "John",
			lastName: "Doe",
			email: form.email,
			gender: "male",
			phoneNumber: form.phone_number,
			mobileNumber: form.mobile_number,
			addressLine1: form.address.address_line_1,
			addressLine2: form.address.address_line_2,
			addressLine3: form.address.address_line_3,
			postcode: form.address.postcode,
			country: form.address.country,
		});
		expect(new Date(stored.body.dateOfBirth).toISOString().slice(0, 10)).toBe(form.date_of_birth);
	});

	it('maps gender "other" to "prefer-not-to-say"', async () => {
		const form = buildForm(fixtures.personTwo);
		await request(app).post("/ingest").send(form).expect(202);

		const stored = await waitFor(
			() => request(app).get(`/forms/${form.application_reference}`),
			(res) => res.status === 200
		);

		expect(stored.body.gender).toBe("prefer-not-to-say");
	});

	it("handles a form missing the optional address_line_3", async () => {
		const form = buildForm(fixtures.personTwo);
		await request(app).post("/ingest").send(form).expect(202);

		const stored = await waitFor(
			() => request(app).get(`/forms/${form.application_reference}`),
			(res) => res.status === 200
		);

		expect(stored.body.addressLine3).toBeUndefined();
	});

	it("handles a form missing the optional phone_number", async () => {
		const form = buildForm(fixtures.personThree);
		await request(app).post("/ingest").send(form).expect(202);

		const stored = await waitFor(
			() => request(app).get(`/forms/${form.application_reference}`),
			(res) => res.status === 200
		);

		expect(stored.body.phoneNumber).toBeUndefined();
	});

	it("enriches the form with longitude/latitude from the geocoding provider", async () => {
		const form = buildForm(fixtures.personOne);
		await request(app).post("/ingest").send(form).expect(202);

		const stored = await waitFor(
			() => request(app).get(`/forms/${form.application_reference}`),
			(res) => res.status === 200
		);

		expect(stored.body.longitude).toBe(50.05);
		expect(stored.body.latitude).toBe(-5.05);
		expect(mockLookupPostcode).toHaveBeenCalledWith(expect.stringContaining(form.address.postcode));
	});
});
