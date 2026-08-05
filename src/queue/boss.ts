import PgBoss from "pg-boss";

export const INGESTION_QUEUE = "form-ingestion";
export const EMAIL_QUEUE = "form-email";

let started: Promise<PgBoss> | undefined;

export function getBoss(): Promise<PgBoss> {
    if (!started) {
        started = (async () => {
            const boss = new PgBoss({
                connectionString: process.env.DATABASE_URL as string,
                // pg-boss v11.0.0 has no default for this, leaving setInterval(fn, NaN),
                // which free-runs at ~1ms and races with stop() closing the pool.
                superviseIntervalSeconds: 60,
            });
            boss.on("error", (error) => console.error("pg-boss error", error));
            await boss.start();
            // Our own consumers catch every expected failure mode themselves and route it
            // to our dlq table (retryable via POST /retry) rather than throwing - that's
            // the one, explicit retry mechanism. pg-boss's own retryLimit defaults to 2,
            // which would silently reprocess a job (and its side effects, e.g. the
            // confirmation email) a second time on any unexpected/uncaught error.
            await boss.createQueue(INGESTION_QUEUE, { name: INGESTION_QUEUE, retryLimit: 0 });
            await boss.createQueue(EMAIL_QUEUE, { name: EMAIL_QUEUE, retryLimit: 0 });
            return boss;
        })();
    }
    return started;
}

export async function stopBoss(): Promise<void> {
    if (!started) {
        return;
    }
    const boss = await started;
    started = undefined;
    await boss.stop();
}
