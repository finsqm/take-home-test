import { getBoss, INGESTION_QUEUE, EMAIL_QUEUE } from "../queue/boss";
import { processIngestionJob, IngestionJobData } from "./ingestion";
import { processEmailJob, EmailJobData } from "./email";

let started: Promise<void> | undefined;

export function startConsumers(): Promise<void> {
	if (!started) {
		started = (async () => {
			const boss = await getBoss();

			// Default job-pickup polling interval is 2s; the ingestion and email queues
			// are chained (storing a form enqueues an email job), so at the default that
			// compounds into several seconds of pure queue latency per form. 0.5s (the
			// minimum) keeps end-to-end processing responsive.
			const pollingOptions = { pollingIntervalSeconds: 0.5 };

			await boss.work<IngestionJobData>(INGESTION_QUEUE, pollingOptions, async (jobs) => {
				for (const job of jobs) {
					await processIngestionJob(job.data);
				}
			});

			await boss.work<EmailJobData>(EMAIL_QUEUE, pollingOptions, async (jobs) => {
				for (const job of jobs) {
					await processEmailJob(job.data);
				}
			});
		})();
	}
	return started;
}
