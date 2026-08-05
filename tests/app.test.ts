import request from "supertest";
import app from "../src/app";

jest.mock("../src/db/client");
import { query } from "../src/db/client";

const mockQuery = query as jest.MockedFunction<typeof query>;

describe("POST /ingest", () => {
	beforeEach(() => {
		mockQuery.mockReset();
		mockQuery.mockResolvedValue([]);
	});

	it("returns 202 (accepted for async processing, not synchronously processed)", async () => {
		const response = await request(app)
			.post("/ingest")
			.send({ session_id: "session-1", application_reference: "GRU-1-2026" });

		expect(response.status).toBe(202);
	});

	it("writes the raw payload to the raw_form table", async () => {
		const form = { session_id: "session-1", application_reference: "GRU-1-2026", name: "John Doe" };

		await request(app).post("/ingest").send(form);

		expect(mockQuery).toHaveBeenCalledWith(
			expect.stringContaining("INSERT INTO raw_form"),
			["session-1", "GRU-1-2026", expect.objectContaining(form)]
		);
	});

	it("returns 500 without accepting the form when the raw write fails", async () => {
		mockQuery.mockRejectedValueOnce(new Error("db down"));

		const response = await request(app)
			.post("/ingest")
			.send({ session_id: "session-2", application_reference: "GRU-2-2026" });

		expect(response.status).toBe(500);
	});
});
