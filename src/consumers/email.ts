import { sendEmail } from "../providers/sendgrid";
import { writeDlqEntry } from "../db/dlq";
import { withRootSpan } from "../tracer";

export type EmailJobData = {
	applicationReference: string;
	to: string;
	from: string;
	subject: string;
	body: string;
};

export async function processEmailJob(data: EmailJobData): Promise<void> {
	await withRootSpan("email.process", { "app.application_reference": data.applicationReference, "app.to": data.to }, async () => {
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
	});
}
