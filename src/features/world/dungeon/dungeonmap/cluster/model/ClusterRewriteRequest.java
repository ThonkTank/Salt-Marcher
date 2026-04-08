package features.world.dungeon.dungeonmap.cluster.model;

import features.world.dungeon.geometry.GridTranslation;
import features.world.dungeon.model.structures.room.Room;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Canonical cluster rewrite request for replacing one or more persisted clusters.
 */
public record ClusterRewriteRequest(
        List<Cluster> originalClusters,
        List<Cluster> rewrittenClusters,
        GridTranslation translation
) {
    public ClusterRewriteRequest {
        originalClusters = originalClusters == null ? List.of() : List.copyOf(originalClusters);
        rewrittenClusters = rewrittenClusters == null ? List.of() : List.copyOf(rewrittenClusters);
        translation = translation == null ? GridTranslation.none() : translation;
    }

    public static ClusterRewriteRequest of(List<Cluster> originalClusters, List<Cluster> rewrittenClusters) {
        return new ClusterRewriteRequest(originalClusters, rewrittenClusters, GridTranslation.none());
    }

    public static ClusterRewriteRequest of(
            List<Cluster> originalClusters,
            List<Cluster> rewrittenClusters,
            GridTranslation translation
    ) {
        return new ClusterRewriteRequest(originalClusters, rewrittenClusters, translation);
    }

    public Set<Long> affectedRoomIds() {
        LinkedHashSet<Long> result = new LinkedHashSet<>();
        for (Cluster cluster : originalClusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.roomTopology().rooms()) {
                if (room != null && room.roomId() != null) {
                    result.add(room.roomId());
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public boolean hasAffectedRooms() {
        return !affectedRoomIds().isEmpty();
    }

    public boolean hasChanges() {
        return !originalClusters.equals(rewrittenClusters) || !translation.isZero();
    }
}
