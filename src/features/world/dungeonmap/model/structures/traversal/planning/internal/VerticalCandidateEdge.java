package features.world.dungeonmap.model.structures.traversal.planning.internal;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;

public record VerticalCandidateEdge(
        TraversalNodeId startNodeId,
        TraversalNodeId endNodeId,
        List<StairCandidate> stairCandidates,
        long costHint
) implements TraversalEdge {

    public VerticalCandidateEdge {
        Objects.requireNonNull(startNodeId, "startNodeId");
        Objects.requireNonNull(endNodeId, "endNodeId");
        if (startNodeId.equals(endNodeId)) {
            throw new IllegalArgumentException("edge must connect distinct nodes");
        }
        stairCandidates = normalizeCandidates(stairCandidates);
        costHint = normalizeCostHint(stairCandidates, costHint);
    }

    @Override
    public TraversalEdgeKind kind() {
        return TraversalEdgeKind.VERTICAL_CANDIDATE;
    }

    public boolean hasCandidates() {
        return !stairCandidates.isEmpty();
    }

    private static List<StairCandidate> normalizeCandidates(List<StairCandidate> stairCandidates) {
        if (stairCandidates == null || stairCandidates.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<StairCandidate> deduplicated = new LinkedHashSet<>();
        for (StairCandidate stairCandidate : stairCandidates) {
            if (stairCandidate != null) {
                deduplicated.add(stairCandidate);
            }
        }
        if (deduplicated.isEmpty()) {
            return List.of();
        }
        ArrayList<StairCandidate> result = new ArrayList<>(deduplicated);
        result.sort(java.util.Comparator.comparingLong(StairCandidate::costHint));
        return List.copyOf(result);
    }

    private static long normalizeCostHint(List<StairCandidate> stairCandidates, long costHint) {
        if (costHint >= 0L) {
            return costHint;
        }
        if (stairCandidates == null || stairCandidates.isEmpty()) {
            return Long.MAX_VALUE;
        }
        return stairCandidates.stream()
                .mapToLong(StairCandidate::costHint)
                .min()
                .orElse(Long.MAX_VALUE);
    }
}
