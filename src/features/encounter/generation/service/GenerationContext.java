package features.encounter.generation.service;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.LongSupplier;
import java.util.random.RandomGenerator;

/**
 * Carries runtime dependencies for encounter generation so the pipeline
 * can be deterministic and testable when needed.
 */
public final class GenerationContext {
    public static final long DEFAULT_TIMEOUT_MS = 1200L;

    private final LongSupplier nanoTimeSource;
    private final RandomGenerator random;
    private final long timeoutNanos;
    private final long startNanos;

    private GenerationContext(LongSupplier nanoTimeSource, RandomGenerator random, long timeoutMs) {
        this.nanoTimeSource = Objects.requireNonNull(nanoTimeSource, "nanoTimeSource");
        this.random = Objects.requireNonNull(random, "random");
        this.timeoutNanos = Math.max(1L, timeoutMs) * 1_000_000L;
        this.startNanos = this.nanoTimeSource.getAsLong();
    }

    public static GenerationContext defaultContext() {
        return new GenerationContext(System::nanoTime, ThreadLocalRandom.current(), DEFAULT_TIMEOUT_MS);
    }

    public static GenerationContext of(LongSupplier nanoTimeSource, RandomGenerator random, long timeoutMs) {
        return new GenerationContext(nanoTimeSource, random, timeoutMs);
    }

    public long deadlineNanos() {
        return startNanos + timeoutNanos;
    }

    public boolean isExpired(long deadlineNanos) {
        return nanoTimeSource.getAsLong() > deadlineNanos;
    }

    public int nextInt(int bound) {
        return random.nextInt(bound);
    }

    public int nextInt(int origin, int bound) {
        return random.nextInt(origin, bound);
    }

    public double nextDouble() {
        return random.nextDouble();
    }

    public <T> void shuffle(List<T> list) {
        for (int i = list.size() - 1; i > 0; i--) {
            int j = nextInt(i + 1);
            T tmp = list.get(i);
            list.set(i, list.get(j));
            list.set(j, tmp);
        }
    }
}
