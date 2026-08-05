import request from "supertest";
import app from "../../src/app";
import { fixtures, buildForm } from "./helpers/fixtures";
import { waitFor } from "./helpers/poll";

describe("schema drift from the 3rd-party provider", () => {
	it("still accepts (202) a payload that violates IngestedFormSchema", async () => {
		const form = buildForm(fixtures.personOne, { gender: "unspecified" });

		const response = await request(app).post("/ingest").send(form);

		expect(response.status).toBe(202);
	});

	it("routes a schema-invalid form to a non-retryable DLQ entry", async () => {
		const form = buildForm(fixtures.personOne, { gender: "unspecified" });
		await request(app).post("/ingest").send(form).expect(202);

		const dlqEntry = await waitFor(
			() => request(app).get(`/dlq/${form.application_reference}`),
			(res) => res.status === 200
		);

		expect(dlqEntry.body).toMatchObject({ retryable: false });
	});

	it("never writes a schema-invalid form to the transformed table", async () => {
		const form = buildForm(fixtures.personOne, { gender: "unspecified" });
		await request(app).post("/ingest").send(form).expect(202);

		await waitFor(
			() => request(app).get(`/dlq/${form.application_reference}`),
			(res) => res.status === 200
		);

		const stored = await request(app).get(`/forms/${form.application_reference}`);
		expect(stored.status).toBe(404);
	});

	it("DLQs (non-retryable) a payload missing a required field entirely", async () => {
		const form = buildForm(fixtures.personOne, { email: undefined });
		await request(app).post("/ingest").send(form).expect(202);

		const dlqEntry = await waitFor(
			() => request(app).get(`/dlq/${form.application_reference}`),
			(res) => res.status === 200
		);

		expect(dlqEntry.body).toMatchObject({ retryable: false });
	});
});
