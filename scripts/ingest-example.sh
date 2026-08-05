#!/usr/bin/env bash
# Ingests a valid example form, then polls until it shows up as a transformed form.
set -euo pipefail

APP_URL="${APP_URL:-http://localhost:3000}"
REF="GRU-DEMO-$RANDOM"

echo "POST /ingest (application_reference=$REF)"
curl -sS -X POST "$APP_URL/ingest" \
	-H "Content-Type: application/json" \
	-d "{
		\"session_id\": \"demo-$RANDOM-$RANDOM\",
		\"application_reference\": \"$REF\",
		\"name\": \"Jane Doe\",
		\"email\": \"jane@example.com\",
		\"gender\": \"female\",
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

echo "Polling GET /forms/$REF until the async pipeline finishes (ingest -> validate -> geocode -> store)..."
for _ in $(seq 1 20); do
	code=$(curl -s -o /tmp/ingest-example-response.json -w "%{http_code}" "$APP_URL/forms/$REF")
	if [ "$code" = "200" ]; then
		echo "Transformed and stored:"
		cat /tmp/ingest-example-response.json
		echo
		exit 0
	fi
	sleep 0.5
done

echo "Timed out waiting for the form to appear - check GET $APP_URL/dlq/$REF"
exit 1
