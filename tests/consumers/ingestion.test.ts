jest.mock("../../src/db/client", () => ({
	withAdvisoryLock: jest.fn((_key: string, fn: () => Promise<unknown>) => fn()),
}));
jest.mock("../../src/db/rawForm");
jest.mock("../../src/db/transformedForm");
jest.mock("../../src/db/dlq");
jest.mock("../../src/providers/idealpostcodes");
jest.mock("../../src/queue/boss", () => ({
	EMAIL_QUEUE: "form-email",
	getBoss: jest.fn(),
}));

import { processIngestionJob } from "../../src/consumers/ingestion";
import { getRawFormBySessionId } from "../../src/db/rawForm";
import { findTransformedForm, insertTransformedForm } from "../../src/db/transformedForm";
import { writeDlqEntry, deleteDlqEntry } from "../../src/db/dlq";
import { lookupPostcode } from "../../src/providers/idealpostcodes";
import { getBoss, EMAIL_QUEUE } from "../../src/queue/boss";
import personOne from "../../src/forms/examples/person_one.json";

const mockGetRawForm = getRawFormBySessionId as jest.MockedFunction<typeof getRawFormBySessionId>;
const mockFindTransformed = findTransformedForm as jest.MockedFunction<typeof findTransformedForm>;
const mockInsertTransformed = insertTransformedForm as jest.MockedFunction<typeof insertTransformedForm>;
const mockWriteDlq = writeDlqEntry as jest.MockedFunction<typeof writeDlqEntry>;
const mockDeleteDlq = deleteDlqEntry as jest.MockedFunction<typeof deleteDlqEntry>;
const mockLookupPostcode = lookupPostcode as jest.MockedFunction<typeof lookupPostcode>;
const mockGetBoss = getBoss as jest.MockedFunction<typeof getBoss>;
const mockSend = jest.fn();

const jobData = { sessionId: personOne.session_id, applicationReference: personOne.application_reference };

describe("processIngestionJob", () => {
	beforeEach(() => {
		mockGetRawForm.mockReset().mockResolvedValue(personOne);
		mockFindTransformed.mockReset().mockResolvedValue(undefined);
		mockInsertTransformed.mockReset().mockResolvedValue(true);
		mockWriteDlq.mockReset().mockResolvedValue(undefined);
		mockDeleteDlq.mockReset().mockResolvedValue(undefined);
		mockLookupPostcode.mockReset().mockResolvedValue({ statusCode: 200, body: { longitude: 50.05, latitude: -5.05 } });
		mockSend.mockReset().mockResolvedValue("job-id");
		mockGetBoss.mockReset().mockResolvedValue({ send: mockSend } as never);
	});

	it("skips processing entirely when the form was already transformed (duplicate redelivery)", async () => {
		mockFindTransformed.mockResolvedValue({ applicationReference: jobData.applicationReference } as never);

		await processIngestionJob(jobData);

		expect(mockGetRawForm).not.toHaveBeenCalled();
		expect(mockLookupPostcode).not.toHaveBeenCalled();
		expect(mockInsertTransformed).not.toHaveBeenCalled();
	});

	it("DLQs (retryable) when the raw_form row can't be found", async () => {
		mockGetRawForm.mockResolvedValue(undefined);

		await processIngestionJob(jobData);

		expect(mockWriteDlq).toHaveBeenCalledWith(
			expect.objectContaining({ applicationReference: jobData.applicationReference, stage: "ingestion", retryable: true })
		);
		expect(mockInsertTransformed).not.toHaveBeenCalled();
	});

	it("DLQs (non-retryable) when the raw payload fails schema validation", async () => {
		mockGetRawForm.mockResolvedValue({ ...personOne, gender: "unspecified" });

		await processIngestionJob(jobData);

		expect(mockWriteDlq).toHaveBeenCalledWith(
			expect.objectContaining({ stage: "ingestion", retryable: false })
		);
		expect(mockLookupPostcode).not.toHaveBeenCalled();
		expect(mockInsertTransformed).not.toHaveBeenCalled();
	});

	it("DLQs (retryable) when the geocoding provider fails", async () => {
		mockLookupPostcode.mockResolvedValue({ statusCode: 500, body: undefined });

		await processIngestionJob(jobData);

		expect(mockWriteDlq).toHaveBeenCalledWith(
			expect.objectContaining({ stage: "ingestion", retryable: true })
		);
		expect(mockInsertTransformed).not.toHaveBeenCalled();
	});

	it("DLQs (retryable) when storing the transformed form fails", async () => {
		mockInsertTransformed.mockRejectedValue(new Error("connection terminated"));

		await processIngestionJob(jobData);

		expect(mockWriteDlq).toHaveBeenCalledWith(
			expect.objectContaining({ stage: "ingestion", retryable: true, reason: expect.stringContaining("connection terminated") })
		);
		expect(mockSend).not.toHaveBeenCalled();
	});

	it("stores the transformed form, clears any prior DLQ entry, and triggers the confirmation email job", async () => {
		await processIngestionJob(jobData);

		expect(mockInsertTransformed).toHaveBeenCalledWith(
			expect.objectContaining({
				applicationReference: jobData.applicationReference,
				firstName: "John",
				lastName: "Doe",
				longitude: 50.05,
				latitude: -5.05,
			})
		);
		expect(mockDeleteDlq).toHaveBeenCalledWith(jobData.applicationReference);
		expect(mockSend).toHaveBeenCalledWith(
			EMAIL_QUEUE,
			expect.objectContaining({ applicationReference: jobData.applicationReference, to: "happyforms@bots.com" })
		);
	});

	it("does not trigger a second email when the insert loses a race (application_reference already stored)", async () => {
		mockInsertTransformed.mockResolvedValue(false);

		await processIngestionJob(jobData);

		expect(mockSend).not.toHaveBeenCalled();
	});
});
