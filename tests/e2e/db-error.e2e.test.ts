import request from "supertest";
import app from "../../src/app";
import { fixtures, buildForm } from "./helpers/fixtures";
import { waitFor } from "./helpers/poll";

// src/db/client.ts doesn't exist yet. It's the required DB-access seam this suite
// depends on: a single `query` export that all DB writes funnel through, so a write
// failure can be forced deterministically here without the test suite needing to know
// the real table schema. Until it exists, this whole file fails to load.
jest.mock("../../src/db/client");
const dbClient = require("../../src/db/client") as { query: jest.Mock };

describe("database write failures route to a retryable DLQ", () => {
	it("routes to a retryable DLQ entry when the db write fails", async () => {
		dbClient.query.mockRejectedValueOnce(new Error("simulated db failure"));

		const form = buildForm(fixtures.personOne);
		await request(app).post("/ingest").send(form).expect(202);

		const dlqEntry = await waitFor(
			() => request(app).get(`/dlq/${form.application_reference}`),
			(res) => res.status === 200
		);

		expect(dlqEntry.body).toMatchObject({ retryable: true });
	});
});
