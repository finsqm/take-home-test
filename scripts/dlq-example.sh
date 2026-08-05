#!/usr/bin/env bash
# Ingests a form with a schema violation (invalid gender) to demonstrate the
# non-retryable DLQ path, then reads it back via GET /dlq/:applicationReference.
set -euo pipefail

APP_URL="${APP_URL:-http://localhost:3000}"
REF="GRU-DEMO-BAD-$RANDOM"

echo "POST /ingest with an invalid gender (application_reference=$REF)"
curl -sS -X POST "$APP_URL/ingest" \
	-H "Content-Type: application/json" \
	-d "{
		\"session_id\": \"demo-$RANDOM-$RANDOM\",
		\"application_reference\": \"$REF\",
		\"name\": \"Jane Doe\",
		\"email\": \"jane@example.com\",
		\"gender\": \"not-a-real-gender\",
		\"date_of_birth\": \"1990-01-01\",
		\"mobile_number\": \"07700900000\",
		\"address\": {
			\"address_line_1\": \"1 Test Street\",
			\"address_line_2\": \"Testville\",
			\"postcode\": \"AB1 2CD\",
			\"country\": \"UK\"
		}
	}"
echo

echo "Polling GET /dlq/$REF until the ingestion consumer routes it..."
for _ in $(seq 1 20); do
	code=$(curl -s -o /tmp/dlq-example-response.json -w "%{http_code}" "$APP_URL/dlq/$REF")
	if [ "$code" = "200" ]; then
		echo "DLQ entry (retryable: false - this needs a code fix, not a /retry):"
		cat /tmp/dlq-example-response.json
		echo
		exit 0
	fi
	sleep 0.5
done

echo "Timed out waiting for a DLQ entry to appear"
exit 1
