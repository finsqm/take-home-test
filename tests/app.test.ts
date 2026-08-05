import request from "supertest";
import app from "../src/app";

jest.mock("../src/db/client");
import { query } from "../src/db/client";

jest.mock("../src/queue/boss", () => ({
	INGESTION_QUEUE: "form-ingestion",
	EMAIL_QUEUE: "form-email",
	getBoss: jest.fn(),
	stopBoss: jest.fn(),
}));
import { getBoss, INGESTION_QUEUE } from "../src/queue/boss";

jest.mock("../src/consumers", () => ({
	startConsumers: jest.fn().mockResolvedValue(undefined),
}));

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockGetBoss = getBoss as jest.MockedFunction<typeof getBoss>;
const mockSend = jest.fn();

describe("POST /ingest", () => {
	beforeEach(() => {
		mockQuery.mockReset();
		mockQuery.mockResolvedValue([]);
		mockSend.mockReset();
		mockSend.mockResolvedValue("job-id");
		mockGetBoss.mockReset();
		mockGetBoss.mockResolvedValue({ send: mockSend, work: jest.fn() } as never);
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

	it("pushes an ingestion job to the queue", async () => {
		const form = { session_id: "session-1", application_reference: "GRU-1-2026" };

		await request(app).post("/ingest").send(form);

		expect(mockSend).toHaveBeenCalledWith(INGESTION_QUEUE, {
			sessionId: "session-1",
			applicationReference: "GRU-1-2026",
		});
	});

	it("returns 500 without accepting the form when enqueueing fails", async () => {
		mockSend.mockRejectedValueOnce(new Error("queue down"));

		const response = await request(app)
			.post("/ingest")
			.send({ session_id: "session-3", application_reference: "GRU-3-2026" });

		expect(response.status).toBe(500);
	});
});
