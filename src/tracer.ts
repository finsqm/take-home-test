import { trace, context, ROOT_CONTEXT, SpanStatusCode, Attributes } from "@opentelemetry/api";

// Safe to import anywhere, including in tests where no SDK is registered - the
// OpenTelemetry API falls back to a no-op tracer until telemetry.ts calls sdk.start().
export const tracer = trace.getTracer("take-home-test");

export async function withSpan<T>(name: string, attributes: Attributes, fn: () => Promise<T>): Promise<T> {
	return tracer.startActiveSpan(name, { attributes }, async (span) => {
		try {
			return await fn();
		} catch (err) {
			span.recordException(err as Error);
			span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : String(err) });
			throw err;
		} finally {
			span.end();
		}
	});
}

// pg-boss dequeues jobs via a polling setInterval that's registered exactly once (see
// startConsumers() in consumers/index.ts) - Node's AsyncLocalStorage-based context
// propagation snapshots whatever span was active at that one registration moment and
// replays it on every subsequent timer tick, which would otherwise nest every job's spans
// under whichever HTTP request happened to trigger the first tick. Resetting to
// ROOT_CONTEXT here makes each job execution start its own, unparented trace.
export async function withRootSpan<T>(name: string, attributes: Attributes, fn: () => Promise<T>): Promise<T> {
	return context.with(ROOT_CONTEXT, () => withSpan(name, attributes, fn));
}
