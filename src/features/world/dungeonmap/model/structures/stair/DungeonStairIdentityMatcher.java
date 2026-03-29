package features.world.dungeonmap.model.structures.stair;

import features.world.dungeonmap.model.geometry.CubePoint;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class DungeonStairIdentityMatcher {

    private DungeonStairIdentityMatcher() {
        throw new AssertionError("No instances");
    }

    public static DungeonStair bestMatch(
            DungeonStair desired,
            Collection<DungeonStair> candidates
    ) {
        StairSignature desiredSignature = stairSignature(desired);
        if (desiredSignature == null) {
            return null;
        }
        ArrayList<StairCandidateScore> matches = new ArrayList<>();
        for (DungeonStair candidate : candidates == null ? List.<DungeonStair>of() : candidates) {
            StairSignature candidateSignature = stairSignature(candidate);
            if (candidateSignature == null
                    || !desiredSignature.exitLevels().equals(candidateSignature.exitLevels())) {
                continue;
            }
            matches.add(new StairCandidateScore(
                    candidate,
                    overlapCount(desiredSignature.exitPositions(), candidateSignature.exitPositions()),
                    overlapCount(desiredSignature.footprint(), candidateSignature.footprint()),
                    desiredSignature.anchor(),
                    candidateSignature.anchor()));
        }
        if (matches.isEmpty()) {
            return null;
        }
        matches.sort(StairCandidateScore.ORDER);
        if (matches.size() > 1 && matches.getFirst().compareIdentity(matches.get(1)) == 0) {
            return null;
        }
        return matches.getFirst().stair();
    }

    private static StairSignature stairSignature(DungeonStair stair) {
        if (stair == null) {
            return null;
        }
        LinkedHashSet<CubePoint> exitPositions = new LinkedHashSet<>();
        for (DungeonStairExit exit : stair.exits()) {
            if (exit != null && exit.position() != null) {
                exitPositions.add(exit.position());
            }
        }
        CubePoint anchor = stair.anchor() == null || stair.exitLevels().isEmpty()
                ? null
                : CubePoint.at(stair.anchor(), stair.exitLevels().getFirst());
        return new StairSignature(
                List.copyOf(stair.exitLevels()),
                anchor,
                Set.copyOf(stair.occupiedPositions()),
                Set.copyOf(exitPositions));
    }

    private static int overlapCount(Set<CubePoint> left, Set<CubePoint> right) {
        if (left == null || right == null || left.isEmpty() || right.isEmpty()) {
            return 0;
        }
        int result = 0;
        for (CubePoint point : left) {
            if (right.contains(point)) {
                result++;
            }
        }
        return result;
    }

    private static int anchorDistance(CubePoint left, CubePoint right) {
        if (left == null || right == null) {
            return Integer.MAX_VALUE;
        }
        return Math.abs(left.x() - right.x())
                + Math.abs(left.y() - right.y())
                + Math.abs(left.z() - right.z());
    }

    private record StairSignature(
            List<Integer> exitLevels,
            CubePoint anchor,
            Set<CubePoint> footprint,
            Set<CubePoint> exitPositions
    ) {
    }

    private record StairCandidateScore(
            DungeonStair stair,
            int exitOverlap,
            int footprintOverlap,
            CubePoint desiredAnchor,
            CubePoint candidateAnchor
    ) {
        private static final Comparator<StairCandidateScore> ORDER = Comparator
                .comparingInt(StairCandidateScore::exitOverlap).reversed()
                .thenComparingInt(StairCandidateScore::footprintOverlap).reversed()
                .thenComparingInt(score -> anchorDistance(score.desiredAnchor(), score.candidateAnchor()))
                .thenComparing(score -> score.stair().stairId(), Comparator.nullsLast(Long::compareTo));

        private int compareIdentity(StairCandidateScore other) {
            int exitCompare = Integer.compare(other.exitOverlap(), exitOverlap);
            if (exitCompare != 0) {
                return exitCompare;
            }
            int footprintCompare = Integer.compare(other.footprintOverlap(), footprintOverlap);
            if (footprintCompare != 0) {
                return footprintCompare;
            }
            return Integer.compare(
                    anchorDistance(desiredAnchor(), candidateAnchor()),
                    anchorDistance(other.desiredAnchor(), other.candidateAnchor()));
        }
    }
}
