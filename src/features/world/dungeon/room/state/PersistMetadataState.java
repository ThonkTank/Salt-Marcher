package features.world.dungeon.room.state;

import features.world.dungeon.room.input.PersistMetadataInput;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

@SuppressWarnings("unused")
public record PersistMetadataState(
        long mapId,
        List<ClusterState> rewrittenClusters,
        List<Long> removedRoomIds
) {

    public static PersistMetadataState persistMetadata(PersistMetadataInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        if (input.mapId() <= 0) {
            throw new IllegalArgumentException("mapId");
        }
        ArrayList<ClusterState> rewrittenClusters = new ArrayList<>();
        for (PersistMetadataInput.ClusterInput cluster : input.rewrittenClusters() == null
                ? List.<PersistMetadataInput.ClusterInput>of()
                : input.rewrittenClusters()) {
            if (cluster == null || cluster.clusterId() <= 0) {
                continue;
            }
            ArrayList<RoomState> rooms = new ArrayList<>();
            for (PersistMetadataInput.RoomInput room : cluster.rooms() == null
                    ? List.<PersistMetadataInput.RoomInput>of()
                    : cluster.rooms()) {
                if (room == null) {
                    continue;
                }
                ArrayList<LevelAnchorState> anchors = new ArrayList<>();
                for (PersistMetadataInput.LevelAnchorInput anchor : room.levelAnchors() == null
                        ? List.<PersistMetadataInput.LevelAnchorInput>of()
                        : room.levelAnchors()) {
                    if (anchor == null) {
                        continue;
                    }
                    anchors.add(new LevelAnchorState(anchor.levelZ(), anchor.anchorX2(), anchor.anchorY2()));
                }
                if (anchors.isEmpty()) {
                    continue;
                }
                ArrayList<ExitNarrationState> exitNarrations = new ArrayList<>();
                for (PersistMetadataInput.ExitNarrationInput exitNarration : room.exitNarrations() == null
                        ? List.<PersistMetadataInput.ExitNarrationInput>of()
                        : room.exitNarrations()) {
                    if (exitNarration == null) {
                        continue;
                    }
                    exitNarrations.add(new ExitNarrationState(
                            exitNarration.levelZ(),
                            exitNarration.roomCellX(),
                            exitNarration.roomCellY(),
                            normalizedDirection(exitNarration.direction()),
                            normalizedDescription(exitNarration.description())));
                }
                rooms.add(new RoomState(
                        room.roomId(),
                        normalizedName(room.name()),
                        anchors,
                        normalizedDescription(room.visualDescription()),
                        exitNarrations));
            }
            rewrittenClusters.add(new ClusterState(cluster.clusterId(), rooms));
        }
        LinkedHashSet<Long> removedRoomIds = new LinkedHashSet<>();
        for (Long roomId : input.removedRoomIds() == null ? List.<Long>of() : input.removedRoomIds()) {
            if (roomId != null && roomId > 0) {
                removedRoomIds.add(roomId);
            }
        }
        return new PersistMetadataState(
                input.mapId(),
                rewrittenClusters.isEmpty() ? List.of() : List.copyOf(rewrittenClusters),
                removedRoomIds.isEmpty() ? List.of() : List.copyOf(removedRoomIds));
    }

    public record ClusterState(
            long clusterId,
            List<RoomState> rooms
    ) {
        public ClusterState {
            if (clusterId <= 0) {
                throw new IllegalArgumentException("clusterId");
            }
            rooms = rooms == null ? List.of() : List.copyOf(rooms.stream().filter(java.util.Objects::nonNull).toList());
        }
    }

    public record RoomState(
            Long roomId,
            String name,
            List<LevelAnchorState> levelAnchors,
            String visualDescription,
            List<ExitNarrationState> exitNarrations
    ) {
        public RoomState {
            name = normalizedName(name);
            levelAnchors = levelAnchors == null ? List.of() : List.copyOf(levelAnchors.stream().filter(java.util.Objects::nonNull).toList());
            if (levelAnchors.isEmpty()) {
                throw new IllegalArgumentException("levelAnchors");
            }
            visualDescription = normalizedDescription(visualDescription);
            exitNarrations = exitNarrations == null ? List.of() : List.copyOf(exitNarrations.stream().filter(java.util.Objects::nonNull).toList());
        }
    }

    public record LevelAnchorState(
            int levelZ,
            int anchorX2,
            int anchorY2
    ) {
    }

    public record ExitNarrationState(
            int levelZ,
            int roomCellX,
            int roomCellY,
            String direction,
            String description
    ) {
        public ExitNarrationState {
            direction = normalizedDirection(direction);
            description = normalizedDescription(description);
        }
    }

    private static String normalizedName(String name) {
        return name == null ? "" : name.trim();
    }

    private static String normalizedDescription(String description) {
        return description == null ? "" : description.trim();
    }

    private static String normalizedDirection(String direction) {
        String normalizedDirection = direction == null ? "" : direction.trim().toUpperCase(Locale.ROOT);
        return switch (normalizedDirection) {
            case "", "N", "NORTH" -> "NORTH";
            case "E", "EAST" -> "EAST";
            case "S", "SOUTH" -> "SOUTH";
            case "W", "WEST" -> "WEST";
            default -> throw new IllegalArgumentException("direction");
        };
    }
}
