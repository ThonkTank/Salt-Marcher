package features.world.dungeonmap.model.structures.corridor.planning;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

final class PlannerInstrumentation {

    private static final Logger LOGGER = Logger.getLogger(CorridorPlanningEngine.class.getName());
    private static final String PROFILE_PROPERTY = "saltmarcher.dungeonmap.corridorplanner.profile";

    private final boolean enabled;
    private final Map<Long, Integer> entryCellCountByRoomId = new LinkedHashMap<>();
    private int floodCalls = 0;
    private long floodNanos = 0L;
    private int treeBuilds = 0;
    private int ripUpCycles = 0;

    private PlannerInstrumentation(boolean enabled) {
        this.enabled = enabled;
    }

    static PlannerInstrumentation create() {
        return new PlannerInstrumentation(Boolean.getBoolean(PROFILE_PROPERTY));
    }

    long startTimer() {
        return enabled ? System.nanoTime() : 0L;
    }

    void recordEntryCellCount(Long roomId, int count) {
        if (enabled && roomId != null) {
            entryCellCountByRoomId.put(roomId, count);
        }
    }

    void recordFloodCall() {
        if (enabled) {
            floodCalls++;
        }
    }

    void recordFloodNanos(long nanos) {
        if (enabled) {
            floodNanos += nanos;
        }
    }

    void recordTreeBuild() {
        if (enabled) {
            treeBuilds++;
        }
    }

    void recordRipUpCycle() {
        if (enabled) {
            ripUpCycles++;
        }
    }

    void logSummary(long startedAtNanos) {
        if (!enabled) {
            return;
        }
        long totalPlanNanos = System.nanoTime() - startedAtNanos;
        LOGGER.log(
                Level.INFO,
                () -> "Corridor planning profile: totalMs=" + formatMillis(totalPlanNanos)
                        + ", floodCalls=" + floodCalls
                        + ", floodMs=" + formatMillis(floodNanos)
                        + ", treeBuilds=" + treeBuilds
                        + ", ripUpCycles=" + ripUpCycles
                        + ", entryCellsByRoomId=" + entryCellCountByRoomId);
    }

    private static String formatMillis(long nanos) {
        return String.format(java.util.Locale.ROOT, "%.3f", nanos / 1_000_000.0d);
    }
}
