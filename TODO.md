# Tasks

- [x] Write end to end tests capturing top level requirements (should fail for now):
    - [x] A form with a valid schema is transformed and written to the transformed database table (will require endpoint to query database, and mock db implementation)
    - [x] A valid form sends an email to happyforms@bots.com (using mock sendgrid.ts)
    - [x] A form failing to match the schema pushes to a dead letter queue (non-retryable)
    - [x] A duplicate form does not get re-written
    - [x] A valid form gets lat and long data enriched by the mock geocoding API (idealpostcodes.ts)
    - [x] A database error results in a push to a dead letter queue (retryable)
    - [x] An error from the mock geocoding API results in a DLQ (retryable)
    - [x] An error from the mock sendgrid API results in a DLQ (retryable)
- [ ] Implementation (test cases first, then implementation code)
    - [x] /ingest
        - [x] Write raw json to db and push ingestion job to queue (use pgboss to use postgres table as persistent queue)
    - [x] Consumer for ingestion job
        - [x] Take a lock on the application reference (we'll treat this as the unique ID for forms and the session ID as the unique ID for individual calls to /ingest)
        - [x] Check if form is a duplicate
        - [x] Validate raw json matches ingestion schema, push to DLQ (non-retryable) if fails
        - [x] Transform the form into the transformed_schema
        - [x] Enrich the form with geo data from idealpostcodes.ts, error case to DLQ (retyrable)
        - [x] Store the new form in transformed_schema
        - [x] Storing should also trigger a job in a new queue which will have a consumer to send emails
    - [x] Consumer to send emails
        - [x] Send email (using sendgrid mock)
        - [x] Error case to DLQ (retyrable)

