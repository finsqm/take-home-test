import { trace, context, propagation, ROOT_CONTEXT, SpanStatusCode, Attributes } from "@opentelemetry/api";

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

// The W3C traceparent for whatever span is currently active, e.g. to persist alongside a DB
// row or queue job so a later, unrelated async pickup (a pg-boss job, a /retry call) can
// re-link its own span into the same trace. Undefined if there's no active span (e.g. no
// SDK registered, as in tests).
export function currentTraceParent(): string | undefined {
	const carrier: Record<string, string> = {};
	propagation.inject(context.active(), carrier);
	return carrier.traceparent;
}

// pg-boss dequeues jobs via a polling setInterval that's registered exactly once (see
// startConsumers() in consumers/index.ts) - Node's AsyncLocalStorage-based context
// propagation snapshots whatever span was active at that one registration moment and
// replays it on every subsequent timer tick. Any code running on that timer - including
// work done before a job's own span is opened, e.g. a DB lookup to recover a stored
// traceparent - must explicitly discard that stale context first, or it silently attaches
// to whichever unrelated request happened to be active when the timer was created.
export async function isolated<T>(fn: () => Promise<T>): Promise<T> {
	return context.with(ROOT_CONTEXT, fn);
}

// Runs fn in a fresh trace, linked to traceParent (e.g. recovered from a DB row or job
// payload) when one is available, otherwise a genuinely new, unparented trace.
export async function withLinkedSpan<T>(
	name: string,
	attributes: Attributes,
	traceParent: string | undefined,
	fn: () => Promise<T>
): Promise<T> {
	return isolated(() => {
		const base = traceParent ? propagation.extract(ROOT_CONTEXT, { traceparent: traceParent }) : ROOT_CONTEXT;
		return context.with(base, () => withSpan(name, attributes, fn));
	});
}
