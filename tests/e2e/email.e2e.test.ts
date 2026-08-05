import request from "supertest";
import app from "../../src/app";
import { sendEmail } from "../../src/providers/sendgrid";
import { fixtures, buildForm } from "./helpers/fixtures";
import { waitFor } from "./helpers/poll";

const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

describe("guaranteed email on successful transform", () => {
	it("sends an email to happyforms@bots.com once a form is successfully transformed", async () => {
		const form = buildForm(fixtures.personOne);
		await request(app).post("/ingest").send(form).expect(202);

		await waitFor(
			() => request(app).get(`/forms/${form.application_reference}`),
			(res) => res.status === 200
		);

		// Storing the form only enqueues the confirmation email job (a separate queue with
		// its own consumer, per the intended design) - it doesn't send it inline, so give
		// that second hop a moment to actually be picked up and processed.
		await waitFor(
			async () => mockSendEmail.mock.calls.length,
			(callCount) => callCount > 0
		);

		expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "happyforms@bots.com" }));
	});

	it("does not send an email if the form never successfully transforms", async () => {
		const form = buildForm(fixtures.personOne, { gender: "not-a-real-gender" });
		await request(app).post("/ingest").send(form).expect(202);

		await waitFor(
			() => request(app).get(`/dlq/${form.application_reference}`),
			(res) => res.status === 200
		);

		expect(mockSendEmail).not.toHaveBeenCalled();
	});
});
