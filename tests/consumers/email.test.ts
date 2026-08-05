jest.mock("../../src/providers/sendgrid");
jest.mock("../../src/db/dlq");

import { processEmailJob } from "../../src/consumers/email";
import { sendEmail } from "../../src/providers/sendgrid";
import { writeDlqEntry } from "../../src/db/dlq";

const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockWriteDlq = writeDlqEntry as jest.MockedFunction<typeof writeDlqEntry>;

const jobData = {
	applicationReference: "GRU-1-2026",
	to: "happyforms@bots.com",
	from: "forms@take-home-test.example",
	subject: "New registration received: GRU-1-2026",
	body: "A new registration form has been successfully processed.",
};

describe("processEmailJob", () => {
	beforeEach(() => {
		mockSendEmail.mockReset().mockResolvedValue({ statusCode: 200, body: undefined });
		mockWriteDlq.mockReset().mockResolvedValue(undefined);
	});

	it("sends the confirmation email with the given content", async () => {
		await processEmailJob(jobData);

		expect(mockSendEmail).toHaveBeenCalledWith({
			to: jobData.to,
			from: jobData.from,
			subject: jobData.subject,
			body: jobData.body,
		});
		expect(mockWriteDlq).not.toHaveBeenCalled();
	});

	it("DLQs (retryable) when the email provider fails", async () => {
		mockSendEmail.mockResolvedValue({ statusCode: 500, body: undefined });

		await processEmailJob(jobData);

		expect(mockWriteDlq).toHaveBeenCalledWith(
			expect.objectContaining({
				applicationReference: jobData.applicationReference,
				stage: "email",
				retryable: true,
			})
		);
	});
});
