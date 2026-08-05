import { lookupPostcode } from "../../../src/providers/idealpostcodes";
import { sendEmail } from "../../../src/providers/sendgrid";
import { getBoss, stopBoss, INGESTION_QUEUE, EMAIL_QUEUE } from "../../../src/queue/boss";
import { closePool } from "../../../src/db/client";

jest.mock("../../../src/providers/idealpostcodes");
jest.mock("../../../src/providers/sendgrid");

const mockLookupPostcode = lookupPostcode as jest.MockedFunction<typeof lookupPostcode>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

beforeEach(() => {
	mockLookupPostcode.mockReset().mockResolvedValue({
		statusCode: 200,
		body: { longitude: 50.05, latitude: -5.05 },
	});
	mockSendEmail.mockReset().mockResolvedValue({
		statusCode: 200,
		body: undefined,
	});
});

// All e2e test files share one Postgres database (see global-setup.ts), including
// pg-boss's job tables. If a file finishes before every job it enqueued has actually been
// dequeued (e.g. it only waits on the row a job wrote, not on the job itself completing),
// that job is left sitting in the shared queue table - and the next file's freshly started
// consumer (same global queue names) will pick it up and process it against *that* file's
// mocks, corrupting its assertions. Purging both queues before tearing down prevents that.
//
// pg-boss also keeps polling timers alive on its connection, and db/client.ts's pool keeps
// idle connections open; each test file gets a fresh module registry (and so fresh
// instances of both) but shares the worker process, so a prior file's instances must be
// torn down or their connections/timers leak into the next file (and can crash the
// process with an unhandled 'error' event when the container eventually stops).
afterAll(async () => {
	const boss = await getBoss();
	await boss.deleteAllJobs(INGESTION_QUEUE);
	await boss.deleteAllJobs(EMAIL_QUEUE);
	await stopBoss();
	await closePool();
});
