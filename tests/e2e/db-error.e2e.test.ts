import request from "supertest";
import app from "../../src/app";
import { fixtures, buildForm } from "./helpers/fixtures";
import { waitFor } from "./helpers/poll";

jest.mock("../../src/db/client", () => {
    const actual = jest.requireActual("../../src/db/client");
    return {
        ...actual,
        query: jest.fn(),
        withAdvisoryLock: jest.fn((_key: string, fn: () => Promise<unknown>) => fn()),
    };
});

const dbClient = require("../../src/db/client") as { query: jest.Mock };

describe("database write failures route to a retryable DLQ", () => {
    it("writes a retryable DLQ entry when the transformed_form insert fails", async () => {
        const form = buildForm(fixtures.personOne);

        dbClient.query.mockImplementation((sql: string) => {
            if (sql.startsWith("INSERT INTO raw_form")) return Promise.resolve([]);
            if (sql.startsWith("SELECT payload FROM raw_form")) return Promise.resolve([{ payload: form }]);
            if (sql.startsWith("SELECT * FROM transformed_form")) return Promise.resolve([]); // not a duplicate
            if (sql.startsWith("INSERT INTO transformed_form")) return Promise.reject(new Error("simulated db failure"));
            return Promise.resolve([]);
        });

        await request(app).post("/ingest").send(form).expect(202);

        const dlqCall = await waitFor(
            async () => dbClient.query.mock.calls.find(([sql]: [string]) => sql.startsWith("INSERT INTO dlq")),
            (call) => call !== undefined
        );

        const [, params] = dlqCall as [string, unknown[]];
        expect(params[0]).toBe(form.application_reference); // application_reference
        expect(params[2]).toBe("ingestion"); // stage
        expect(params[3]).toBe(true); // retryable
        expect(params[4]).toContain("database write failed"); // reason
    });
});
