package features.world.dungeon.dungeonmap.cluster.model;

import features.world.dungeon.geometry.GridTranslation;
import features.world.dungeon.model.structures.room.Room;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Canonical cluster rewrite payload for replacing one or more persisted clusters.
 */
public record ClusterRewritePlan(
        List<Cluster> originalClusters,
        List<Cluster> finalClusters,
        GridTranslation translation
) {
    public ClusterRewritePlan {
        originalClusters = originalClusters == null ? List.of() : List.copyOf(originalClusters);
        finalClusters = finalClusters == null ? List.of() : List.copyOf(finalClusters);
        translation = translation == null ? GridTranslation.none() : translation;
    }

    public static ClusterRewritePlan of(List<Cluster> originalClusters, List<Cluster> finalClusters) {
        return new ClusterRewritePlan(originalClusters, finalClusters, GridTranslation.none());
    }

    public static ClusterRewritePlan of(List<Cluster> originalClusters, List<Cluster> finalClusters, GridTranslation translation) {
        return new ClusterRewritePlan(originalClusters, finalClusters, translation);
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
        return !originalClusters.equals(finalClusters) || !translation.isZero();
    }
}
