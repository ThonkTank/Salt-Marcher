package features.world.dungeonmap.model.structures.traversal.planning.internal;

final class TraversalPlanningCostModel {

    private static final int BASE_STAIR_PENALTY_TILES = 18;
    private static final int MIN_STAIR_PENALTY_TILES = 4;
    private static final int STAIR_PENALTY_RELAX_INTERVAL = 10;

    private TraversalPlanningCostModel() {
        throw new AssertionError("No instances");
    }

    static long approximateConnectionScore(long horizontalDistance, long verticalDistance) {
        if (horizontalDistance < 0L || verticalDistance < 0L) {
            return Long.MAX_VALUE;
        }
        long baseDistance = horizontalDistance + verticalDistance;
        return penalizeStairs(baseDistance, verticalDistance > 0L ? 1 : 0);
    }

    static long penalizeStairs(long baseDistance, int stairCount) {
        if (baseDistance < 0L) {
            return Long.MAX_VALUE;
        }
        if (stairCount <= 0) {
            return baseDistance;
        }
        return baseDistance + (long) stairCount * stairPenaltyTiles(baseDistance);
    }

    private static int stairPenaltyTiles(long baseDistance) {
        if (baseDistance < 0L) {
            return Integer.MAX_VALUE;
        }
        long relaxedPenalty = BASE_STAIR_PENALTY_TILES - (baseDistance / STAIR_PENALTY_RELAX_INTERVAL);
        return (int) Math.max(MIN_STAIR_PENALTY_TILES, relaxedPenalty);
    }
}
