import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

// This module has side effects on import (it patches http/express before they're
// required elsewhere) and must be the very first thing index.ts imports.
//
// Only http/express are auto-instrumented, deliberately not the full
// auto-instrumentations-node meta-package's `pg` instrumentation - that would also trace
// pg-boss's own internal polling queries (every 500ms per queue, see queue/boss.ts),
// flooding traces with noise unrelated to form processing. Our own db/client.ts's query()
// is manually wrapped in a span instead, which only covers our application's queries.
const sdk = new NodeSDK({
	resource: resourceFromAttributes({
		[ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "take-home-test",
	}),
	traceExporter: new OTLPTraceExporter(),
	instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation()],
});

sdk.start();

process.on("SIGTERM", () => {
	sdk.shutdown().finally(() => process.exit(0));
});
