package features.world.dungeonmap.model.structures.corridor.planning;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

final class PlannerInstrumentation {

    private static final Logger LOGGER = Logger.getLogger(CorridorPlanningEngine.class.getName());
    private static final String PROFILE_PROPERTY = "saltmarcher.dungeonmap.corridorplanner.profile";

    private final boolean enabled;
    private final Map<Long, Integer> exitCandidateCountByRoomId = new LinkedHashMap<>();
    private int routeSearchCalls = 0;
    private long routeSearchNanos = 0L;
    private int networkScoreCalls = 0;
    private long networkScoreNanos = 0L;

    private PlannerInstrumentation(boolean enabled) {
        this.enabled = enabled;
    }

    static PlannerInstrumentation create() {
        return new PlannerInstrumentation(Boolean.getBoolean(PROFILE_PROPERTY));
    }

    long startTimer() {
        return enabled ? System.nanoTime() : 0L;
    }

    void recordExitCandidateCount(Long roomId, int count) {
        if (enabled && roomId != null) {
            exitCandidateCountByRoomId.put(roomId, count);
        }
    }

    void recordRouteSearchCall() {
        if (enabled) {
            routeSearchCalls++;
        }
    }

    void recordRouteSearchNanos(long nanos) {
        if (enabled) {
            routeSearchNanos += nanos;
        }
    }

    void recordNetworkScore(long nanos) {
        if (enabled) {
            networkScoreCalls++;
            networkScoreNanos += nanos;
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
                        + ", routeSearchCalls=" + routeSearchCalls
                        + ", routeSearchMs=" + formatMillis(routeSearchNanos)
                        + ", networkScoreCalls=" + networkScoreCalls
                        + ", networkScoreMs=" + formatMillis(networkScoreNanos)
                        + ", exitCandidatesByRoomId=" + exitCandidateCountByRoomId);
    }

    private static String formatMillis(long nanos) {
        return String.format(java.util.Locale.ROOT, "%.3f", nanos / 1_000_000.0d);
    }
}
