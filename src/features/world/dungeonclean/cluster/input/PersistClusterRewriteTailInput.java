package features.world.dungeonclean.cluster.input;

import java.sql.Connection;
import java.util.ArrayList;
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
        List<ClusterInput> rewrittenClusters,
        List<Long> removedRoomIds
) {

    public PersistClusterRewriteTailInput {
        persistedClusterIds = persistedClusterIds == null ? List.of() : List.copyOf(persistedClusterIds);
        mapId = originalMap == null ? mapId : originalMap.mapId();

        if (rewrittenClusters == null || rewrittenClusters.isEmpty()) {
            ArrayList<ClusterInput> projectedClusters = new ArrayList<>();
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
                    ArrayList<RoomInput> projectedRooms = new ArrayList<>();
                    for (features.world.dungeon.model.structures.room.Room room : cluster.roomTopology().rooms()) {
                        if (room == null) {
                            continue;
                        }
                        ArrayList<LevelAnchorInput> projectedAnchors = new ArrayList<>();
                        for (Map.Entry<Integer, features.world.dungeon.geometry.GridPoint> entry : room.anchorsByLevel().entrySet()) {
                            Integer levelZ = entry.getKey();
                            features.world.dungeon.geometry.GridPoint anchor = entry.getValue();
                            if (levelZ != null && anchor != null) {
                                projectedAnchors.add(new LevelAnchorInput(levelZ, anchor.x2(), anchor.y2()));
                            }
                        }
                        ArrayList<ExitNarrationInput> projectedExitNarrations = new ArrayList<>();
                        for (features.world.dungeon.model.structures.room.RoomExitNarration exitNarration : room.narration().exitNarrations()) {
                            if (exitNarration == null || exitNarration.roomCell() == null || exitNarration.direction() == null) {
                                continue;
                            }
                            projectedExitNarrations.add(new ExitNarrationInput(
                                    exitNarration.levelZ(),
                                    exitNarration.roomCell().x2() / 2,
                                    exitNarration.roomCell().y2() / 2,
                                    exitNarration.direction().name(),
                                    exitNarration.description()));
                        }
                        projectedRooms.add(new RoomInput(
                                room.roomId(),
                                room.name(),
                                projectedAnchors,
                                room.narration().visualDescription(),
                                projectedExitNarrations));
                    }
                    projectedClusters.add(new ClusterInput(persistedClusterId, projectedRooms));
                }
            }
            rewrittenClusters = projectedClusters.isEmpty() ? List.of() : List.copyOf(projectedClusters);
        } else {
            rewrittenClusters = List.copyOf(rewrittenClusters.stream()
                    .filter(java.util.Objects::nonNull)
                    .toList());
        }

        if (removedRoomIds == null || removedRoomIds.isEmpty()) {
            LinkedHashSet<Long> finalRoomIds = new LinkedHashSet<>();
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

    public PersistClusterRewriteTailInput(
            Connection connection,
            features.world.dungeon.dungeonmap.model.DungeonMap originalMap,
            features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest rewriteRequest,
            List<Long> persistedClusterIds
    ) {
        this(connection, originalMap, rewriteRequest, persistedClusterIds, 0L, List.of(), List.of());
    }

    public record ClusterInput(
            long clusterId,
            List<RoomInput> rooms
    ) {

        public ClusterInput {
            rooms = rooms == null ? List.of() : List.copyOf(rooms.stream()
                    .filter(java.util.Objects::nonNull)
                    .toList());
        }
    }

    public record RoomInput(
            Long roomId,
            String name,
            List<LevelAnchorInput> levelAnchors,
            String visualDescription,
            List<ExitNarrationInput> exitNarrations
    ) {

        public RoomInput {
            name = name == null ? "" : name.trim();
            levelAnchors = levelAnchors == null ? List.of() : List.copyOf(levelAnchors.stream()
                    .filter(java.util.Objects::nonNull)
                    .toList());
            visualDescription = visualDescription == null ? "" : visualDescription.trim();
            exitNarrations = exitNarrations == null ? List.of() : List.copyOf(exitNarrations.stream()
                    .filter(java.util.Objects::nonNull)
                    .toList());
        }
    }

    public record LevelAnchorInput(
            int levelZ,
            int anchorX2,
            int anchorY2
    ) {
    }

    public record ExitNarrationInput(
            int levelZ,
            int roomCellX,
            int roomCellY,
            String direction,
            String description
    ) {

        public ExitNarrationInput {
            direction = direction == null ? "NORTH" : direction.trim();
            description = description == null ? "" : description.trim();
        }
    }
}
