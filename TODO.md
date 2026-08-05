# Tasks

- [ ] Write end to end tests capturing top level requirements (should fail for now):
    - [ ] A form with a valid schema is transformed and written to the transformed database table (will require endpoint to query database, and mock db implementation)
    - [ ] A valid form sends an email to happyforms@bots.com (using mock sendgrid.ts)
    - [ ] A form failing to match the schema pushes to a dead letter queue (non-retryable)
    - [ ] A duplicate form does not get re-written
    - [ ] A valid form gets lat and long data enriched by the mock geocoding API (idealpostcodes.ts)
    - [ ] A database error results in a push to a dead letter queue (retryable)
    - [ ] An error from the mock geocoding API results in a DLQ (retryable)
    - [ ] An error from the mock sendgrid API results in a DLQ (retryable)
- [ ] Implementation (test cases first, then implementation code)
    - [ ] /ingest
        - [ ] Write raw json to db and push ingestion job to queue (use pgboss to use postgres table as persistent queue)
    - [ ] Consumer for ingestion job
        - [ ] Take a lock on the application reference (we'll treat this as the unique ID for forms and the session ID as the unique ID for individual calls to /ingest)
        - [ ] Check if form is a duplicate
        - [ ] Validate raw json matches ingestion schema, push to DLQ (non-retryable) if fails
        - [ ] Transform the form into the transformed_schema
        - [ ] Enrich the form with geo data from idealpostcodes.ts, error case to DLQ (retyrable)
        - [ ] Store the new form in transformed_schema
        - [ ] Storing should also trigger a job in a new queue which will have a consumer to send emails
    - [ ] Consumer to send emails
        - [ ] Send email (using sendgrid mock)
        - [ ] Error case to DLQ (retyrable)

