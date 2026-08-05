import { sendEmail } from "../providers/sendgrid";
import { writeDlqEntry } from "../db/dlq";

export type EmailJobData = {
	applicationReference: string;
	to: string;
	from: string;
	subject: string;
	body: string;
};

export async function processEmailJob(data: EmailJobData): Promise<void> {
	const response = await sendEmail({ to: data.to, from: data.from, subject: data.subject, body: data.body });

	if (response.statusCode !== 200) {
		await writeDlqEntry({
			applicationReference: data.applicationReference,
			stage: "email",
			retryable: true,
			reason: `email provider returned status ${response.statusCode}`,
			payload: data,
		});
	}
}
