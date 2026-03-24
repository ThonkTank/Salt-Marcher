package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CubePoint;

final class RouteSearch {

    static final int MAX_CORNER_PENALTY_TILES = 5;
    static final int MIN_CORNER_PENALTY_TILES = 2;
    static final int CORNER_PENALTY_RELAXATION_INTERVAL = 12;

    private RouteSearch() {
    }

    static int compareRoutePriority(int distance, int corners, int otherDistance, int otherCorners) {
        int valueComparison = Integer.compare(routeValue(distance, corners), routeValue(otherDistance, otherCorners));
        if (valueComparison != 0) {
            return valueComparison;
        }
        int cornerComparison = Integer.compare(corners, otherCorners);
        if (cornerComparison != 0) {
            return cornerComparison;
        }
        return Integer.compare(distance, otherDistance);
    }

    static int routeValue(int distance, int corners) {
        return distance + corners * cornerPenaltyTiles(distance);
    }

    static int cornerPenaltyTiles(int distance) {
        if (distance <= 0) {
            return MAX_CORNER_PENALTY_TILES;
        }
        int relaxedPenalty = MAX_CORNER_PENALTY_TILES - (distance / CORNER_PENALTY_RELAXATION_INTERVAL);
        return Math.max(MIN_CORNER_PENALTY_TILES, relaxedPenalty);
    }
}

record RouteCost(int distance, int corners) implements Comparable<RouteCost> {
    @Override
    public int compareTo(RouteCost other) {
        return RouteSearch.compareRoutePriority(distance, corners, other.distance, other.corners);
    }
}

record PathState(CubePoint point, int directionIndex) {
}

record PathNode(PathState state, RouteCost score) {
}
