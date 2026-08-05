import { lookupPostcode } from "../../../src/providers/idealpostcodes";
import { sendEmail } from "../../../src/providers/sendgrid";

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
