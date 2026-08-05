import express, { Request, Response } from "express";
import { query } from "./db/client";

const app = express();

app.use(express.json());

app.post("/ingest", async (req: Request, res: Response) => {
    try {
        await query(
            `INSERT INTO raw_form (session_id, application_reference, payload) VALUES ($1, $2, $3)`,
            [req.body?.session_id, req.body?.application_reference, req.body]
        );
    } catch (err) {
        res.status(500).json({ message: "Failed to accept form for ingestion" });
        return;
    }

    res.status(202).json({ message: "Ingesting form data" });
});

export default app;
