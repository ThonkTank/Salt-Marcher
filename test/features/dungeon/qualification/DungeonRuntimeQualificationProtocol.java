package features.dungeon.qualification;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Fixed production-runtime latency protocol with no retry, trimming, skipping, or adaptive budget path. */
public final class DungeonRuntimeQualificationProtocol {
    public static final int WARMUP_SAMPLES = 20;
    public static final int MEASURED_SAMPLES = 100;
    public static final long CAMERA_P95_NANOS = 16_000_000L;
    public static final long HOVER_P95_NANOS = 16_000_000L;
    public static final long PREVIEW_P95_NANOS = 50_000_000L;

    private DungeonRuntimeQualificationProtocol() {
    }

    public static Histogram measureAlternating(AlternatingInput input) {
        return measureAlternating(index -> { }, input);
    }

    public static Histogram measureAlternating(AlternatingInput prepare, AlternatingInput input) {
        for (int index = 0; index < WARMUP_SAMPLES; index++) {
            prepare.run(index);
            input.run(index);
        }
        List<Long> measured = new ArrayList<>(MEASURED_SAMPLES);
        for (int index = 0; index < MEASURED_SAMPLES; index++) {
            prepare.run(index);
            long started = System.nanoTime();
            input.run(index);
            measured.add(System.nanoTime() - started);
        }
        return Histogram.of(measured);
    }

    @FunctionalInterface
    public interface AlternatingInput {
        void run(int index);
    }

    public record Histogram(List<Long> samples, long minimum, long p50, long p95, long maximum) {
        public Histogram {
            samples = List.copyOf(samples);
        }

        static Histogram of(List<Long> measured) {
            if (measured == null || measured.size() != MEASURED_SAMPLES) {
                throw new IllegalArgumentException("qualification requires exactly 100 measured samples");
            }
            List<Long> sorted = new ArrayList<>(measured);
            Collections.sort(sorted);
            return new Histogram(measured, sorted.get(0), nearestRank(sorted, 50),
                    nearestRank(sorted, 95), sorted.get(sorted.size() - 1));
        }

        private static long nearestRank(List<Long> sorted, int percentile) {
            int rank = (int) Math.ceil(percentile / 100.0 * sorted.size());
            return sorted.get(Math.max(0, rank - 1));
        }
    }
}
