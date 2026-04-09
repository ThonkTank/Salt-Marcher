package features.world.dungeon.dungeonmap.cluster.input;

import java.sql.Connection;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

@SuppressWarnings("unused")
public record PersistClusterRewriteTailInput(
        Connection connection,
        features.world.dungeon.dungeonmap.model.DungeonMap originalMap,
        features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest rewriteRequest,
        List<Long> persistedClusterIds,
        long mapId,
        List<Map<String, Object>> rewrittenClusters,
        List<Long> removedRoomIds
) {

    public PersistClusterRewriteTailInput {
        persistedClusterIds = persistedClusterIds == null ? List.of() : List.copyOf(persistedClusterIds);
        mapId = originalMap == null ? mapId : originalMap.mapId();

        ArrayList<Map<String, Object>> projectedClusters = new ArrayList<>();
        if (rewriteRequest != null && rewriteRequest.rewrittenClusters() != null && !rewriteRequest.rewrittenClusters().isEmpty()) {
            if (rewriteRequest.rewrittenClusters().size() != persistedClusterIds.size()) {
                throw new IllegalArgumentException("Persisted cluster ids must match rewritten clusters");
            }
            for (int clusterIndex = 0; clusterIndex < rewriteRequest.rewrittenClusters().size(); clusterIndex++) {
                features.world.dungeon.dungeonmap.cluster.model.Cluster cluster = rewriteRequest.rewrittenClusters().get(clusterIndex);
                Long persistedClusterId = persistedClusterIds.get(clusterIndex);
                if (cluster == null || persistedClusterId == null || persistedClusterId <= 0) {
                    continue;
                }
                ArrayList<Map<String, Object>> projectedRooms = new ArrayList<>();
                for (features.world.dungeon.model.structures.room.Room room : cluster.roomTopology().rooms()) {
                    if (room == null) {
                        continue;
                    }
                    ArrayList<Map<String, Object>> projectedAnchors = new ArrayList<>();
                    for (Map.Entry<Integer, features.world.dungeon.geometry.GridPoint> entry : room.anchorsByLevel().entrySet()) {
                        Integer levelZ = entry.getKey();
                        features.world.dungeon.geometry.GridPoint anchor = entry.getValue();
                        if (levelZ == null || anchor == null) {
                            continue;
                        }
                        LinkedHashMap<String, Object> projectedAnchor = new LinkedHashMap<>();
                        projectedAnchor.put("levelZ", levelZ);
                        projectedAnchor.put("anchorX2", anchor.x2());
                        projectedAnchor.put("anchorY2", anchor.y2());
                        projectedAnchors.add(Map.copyOf(projectedAnchor));
                    }
                    ArrayList<Map<String, Object>> projectedExitNarrations = new ArrayList<>();
                    for (features.world.dungeon.model.structures.room.RoomExitNarration exitNarration : room.narration().exitNarrations()) {
                        if (exitNarration == null || exitNarration.roomCell() == null || exitNarration.direction() == null) {
                            continue;
                        }
                        LinkedHashMap<String, Object> projectedExitNarration = new LinkedHashMap<>();
                        projectedExitNarration.put("levelZ", exitNarration.levelZ());
                        projectedExitNarration.put("roomCellX", exitNarration.roomCell().x2() / 2);
                        projectedExitNarration.put("roomCellY", exitNarration.roomCell().y2() / 2);
                        projectedExitNarration.put("direction", exitNarration.direction().name());
                        projectedExitNarration.put("description", exitNarration.description());
                        projectedExitNarrations.add(Map.copyOf(projectedExitNarration));
                    }
                    LinkedHashMap<String, Object> projectedRoom = new LinkedHashMap<>();
                    projectedRoom.put("roomId", room.roomId());
                    projectedRoom.put("name", room.name());
                    projectedRoom.put("levelAnchors", projectedAnchors.isEmpty() ? List.of() : List.copyOf(projectedAnchors));
                    projectedRoom.put("visualDescription", room.narration().visualDescription());
                    projectedRoom.put("exitNarrations", projectedExitNarrations.isEmpty() ? List.of() : List.copyOf(projectedExitNarrations));
                    projectedRooms.add(Map.copyOf(projectedRoom));
                }
                LinkedHashMap<String, Object> projectedCluster = new LinkedHashMap<>();
                projectedCluster.put("clusterId", persistedClusterId);
                projectedCluster.put("rooms", projectedRooms.isEmpty() ? List.of() : List.copyOf(projectedRooms));
                projectedClusters.add(Map.copyOf(projectedCluster));
            }
        }
        rewrittenClusters = rewrittenClusters == null || rewrittenClusters.isEmpty()
                ? (projectedClusters.isEmpty() ? List.of() : List.copyOf(projectedClusters))
                : List.copyOf(rewrittenClusters);

        LinkedHashSet<Long> finalRoomIds = new LinkedHashSet<>();
        if (removedRoomIds == null || removedRoomIds.isEmpty()) {
            if (rewriteRequest != null && rewriteRequest.rewrittenClusters() != null) {
                for (features.world.dungeon.dungeonmap.cluster.model.Cluster cluster : rewriteRequest.rewrittenClusters()) {
                    if (cluster == null) {
                        continue;
                    }
                    for (features.world.dungeon.model.structures.room.Room room : cluster.roomTopology().rooms()) {
                        if (room != null && room.roomId() != null && room.roomId() > 0) {
                            finalRoomIds.add(room.roomId());
                        }
                    }
                }
            }
            LinkedHashSet<Long> projectedRemovedRoomIds = new LinkedHashSet<>();
            if (rewriteRequest != null && rewriteRequest.originalClusters() != null) {
                for (features.world.dungeon.dungeonmap.cluster.model.Cluster cluster : rewriteRequest.originalClusters()) {
                    if (cluster == null) {
                        continue;
                    }
                    for (features.world.dungeon.model.structures.room.Room room : cluster.roomTopology().rooms()) {
                        if (room != null
                                && room.roomId() != null
                                && room.roomId() > 0
                                && !finalRoomIds.contains(room.roomId())) {
                            projectedRemovedRoomIds.add(room.roomId());
                        }
                    }
                }
            }
            removedRoomIds = projectedRemovedRoomIds.isEmpty() ? List.of() : List.copyOf(projectedRemovedRoomIds);
        } else {
            LinkedHashSet<Long> normalizedRemovedRoomIds = new LinkedHashSet<>();
            for (Long roomId : removedRoomIds) {
                if (roomId != null && roomId > 0) {
                    normalizedRemovedRoomIds.add(roomId);
                }
            }
            removedRoomIds = normalizedRemovedRoomIds.isEmpty() ? List.of() : List.copyOf(normalizedRemovedRoomIds);
        }
    }
}
