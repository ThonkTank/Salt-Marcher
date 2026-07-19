package platform.diagnostics;

import java.time.Duration;
import java.util.Objects;

/** Payload-free local timing and cardinality measurement for one bounded operation. */
public record Measurement(
        DiagnosticId id,
        long operationId,
        long durationNanos,
        int cardinality,
        int queryCount
) {

    private static final long MAX_DURATION_NANOS = Duration.ofHours(1).toNanos();
    private static final int MAX_COUNT = 1_000_000;

    public Measurement {
        id = Objects.requireNonNull(id, "id");
        if (operationId < 0L) {
            throw new IllegalArgumentException("operation id must be nonnegative");
        }
        if (durationNanos < 0L || durationNanos > MAX_DURATION_NANOS) {
            throw new IllegalArgumentException("duration must be between zero and one hour");
        }
        if (cardinality < 0 || cardinality > MAX_COUNT) {
            throw new IllegalArgumentException("cardinality is outside the supported range");
        }
        if (queryCount < 0 || queryCount > MAX_COUNT) {
            throw new IllegalArgumentException("query count is outside the supported range");
        }
    }
}
