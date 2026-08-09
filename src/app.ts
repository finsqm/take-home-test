import express, { Request, Response } from "express";
import { insertRawForm } from "./db/rawForm";
import { findTransformedForm } from "./db/transformedForm";
import { getDlqEntry } from "./db/dlq";
import { getBoss, INGESTION_QUEUE, EMAIL_QUEUE } from "./queue/boss";
import { startConsumers } from "./consumers";
import { currentTraceParent } from "./tracer";

const app = express();

app.use(express.json());

app.post("/ingest", async (req: Request, res: Response) => {
    const sessionId = req.body?.session_id;
    const applicationReference = req.body?.application_reference;

    try {
        await insertRawForm(sessionId, applicationReference, req.body, currentTraceParent());

        // Idempotent/memoized (see index.ts, which also calls this at boot) - this call is
        // the belt-and-suspenders case for an instance whose consumers didn't start at boot
        // for some reason; it's a no-op once they're already running.
        await startConsumers();

        const boss = await getBoss();
        await boss.send(INGESTION_QUEUE, { sessionId, applicationReference });
    } catch (err) {
        res.status(500).json({ message: "Failed to accept form for ingestion" });
        return;
    }

    res.status(202).json({ message: "Ingesting form data" });
});

app.get("/forms/:applicationReference", async (req: Request, res: Response) => {
    const form = await findTransformedForm(String(req.params.applicationReference));

    if (!form) {
        res.status(404).json({ message: "Form not found" });
        return;
    }

    res.status(200).json(form);
});

app.get("/dlq/:applicationReference", async (req: Request, res: Response) => {
    const entry = await getDlqEntry(String(req.params.applicationReference));

    if (!entry) {
        res.status(404).json({ message: "No DLQ entry found for this application reference" });
        return;
    }

    res.status(200).json(entry);
});

app.post("/retry/:applicationReference", async (req: Request, res: Response) => {
    const entry = await getDlqEntry(String(req.params.applicationReference));

    if (!entry) {
        res.status(404).json({ message: "No DLQ entry found for this application reference" });
        return;
    }

    const boss = await getBoss();
    const queue = entry.stage === "email" ? EMAIL_QUEUE : INGESTION_QUEUE;
    await boss.send(queue, entry.payload);

    res.status(202).json({ message: "Retrying" });
});

export default app;
