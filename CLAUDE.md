# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A take-home test: build a system that ingests healthcare registration forms from an unreliable 3rd party, validates/transforms them, enriches them with geocoded lat/long, and makes them available to a downstream consumer ("FORM-BOT"). Full requirements are in README.md; the intended build order and task breakdown is in TODO.md — check both before making architectural decisions, since the implementation is currently just a skeleton (a single `/ingest` stub endpoint) and TODO.md reflects the planned design, not necessarily the final one.

Key correctness requirements from the brief (README.md) that any implementation must satisfy:
- The external provider does not guarantee exactly-once delivery, and schema changes may arrive without notice — ingestion must tolerate duplicate forms and schema drift.
- The FORM-BOT must never receive the same form twice.
- A successful transform must trigger a guaranteed email to `happyforms@bots.com`.
- Failed steps (schema validation, geocoding, email, db) should be capturable and retryable via something like a `/retry` endpoint / DLQ, without losing the original data, so a code fix can be deployed and the form reprocessed.
- Use a real database (schema design is part of what's being evaluated), not an in-memory mock.

## Commands

```bash
npm run dev      # run with ts-node-dev (auto-restart) against src/index.ts
npm run build     # compile via tsc to dist/
npm start        # run compiled output (dist/index.js)
npm test         # run jest (ts-jest) test suite
```

Run a single test file: `npx jest tests/app.test.ts`. Run tests matching a name: `npx jest -t "should return 200"`.

There is no lint script configured.

## Architecture

- `src/app.ts` — Express app definition (routes live here), exported separately from the server bootstrap so it can be imported directly into tests without binding a port.
- `src/index.ts` — process entrypoint; imports `app` and calls `.listen()`.
- `src/forms/schemas/ingested_schema.ts` — `IngestedFormSchema`: the shape currently agreed with the 3rd-party provider (snake_case fields, e.g. `session_id`, `date_of_birth`). Treat this as unreliable/best-effort — the provider can change it without notice, so validation against it (not a compile-time assumption) is how schema drift gets caught at runtime.
- `src/forms/schemas/transformed_schema.ts` — `TransformedFormSchema`: the internal/output shape (camelCase, `Date` for DOB, split `firstName`/`lastName`, adds `longitude`/`latitude`). This is what gets handed to FORM-BOT.
- `src/forms/examples/*.json` — sample raw ingested payloads, useful as fixtures. Note they're deliberately inconsistent with each other (e.g. `person_two.json` has no `address_line_3`, `person_three.json` has no `phone_number`) — this mirrors the real-world flakiness the system needs to handle, not a mistake to normalize away.
- `src/providers/idealpostcodes.ts` — mock geocoding API (`lookupPostcode`). Simulates latency (1s) and a ~5% failure rate (`statusCode: 500`); treat failures as retryable.
- `src/providers/sendgrid.ts` — mock email API (`sendEmail`). Same latency/failure-rate simulation; also retryable.
- `src/providers/httpresponse.ts` — shared `HttpResponse<T>` envelope (`{ statusCode, body? }`) used by both provider mocks.

Both provider mocks are randomized and async by design — any code calling them must handle the failure branch (`statusCode !== 200`, `body` undefined) as a first-class, retryable case rather than an edge case.

## Testing

Tests use `supertest` against the exported `app` (not a live server) plus `ts-jest`. `tests/app.test.ts` is currently a placeholder for the `/ingest` endpoint; TODO.md lists the end-to-end scenarios (duplicate handling, schema-mismatch → non-retryable DLQ, provider errors → retryable DLQ, successful transform → db write + email) that are expected to be covered as the implementation is built out.
