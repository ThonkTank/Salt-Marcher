package features.world.quarantine.dungeonmap.inspector;

import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.rooms.model.DungeonGeometry;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.rooms.model.RoomShape;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

public final class DungeonInspectorPresenter {

    private DungeonInspectorPresenter() {
        throw new AssertionError("No instances");
    }

    public static DungeonRoomSummary roomSummary(DungeonLayout layout, DungeonRoom room, boolean active) {
        if (room == null) {
            return null;
        }
        if (layout == null || layout.map() == null) {
            throw new IllegalArgumentException("Raum-Inspector braucht ein geladenes Layout");
        }
        RoomShape shape = DungeonGeometry.roomShape(layout, room);
        return new DungeonRoomSummary(
                room.roomId(),
                layout.map().mapId(),
                room.name(),
                shape.center().x(),
                shape.center().y(),
                shape.relativeVertices().size(),
                active);
    }

    public static DungeonRoomClusterSummary clusterSummary(DungeonLayout layout, DungeonRoomCluster cluster, boolean active) {
        if (cluster == null) {
            return null;
        }
        List<Long> roomIds = layout == null
                ? List.of()
                : layout.roomsForCluster(cluster.clusterId()).stream()
                        .map(DungeonRoom::roomId)
                        .filter(Objects::nonNull)
                        .sorted()
                        .toList();
        List<String> roomNames = roomIds.stream()
                .map(roomId -> {
                    DungeonRoom room = layout == null ? null : layout.findRoom(roomId);
                    return room == null ? "Raum " + roomId : room.name();
                })
                .toList();
        Set<Long> roomIdSet = new HashSet<>(roomIds);
        return new DungeonRoomClusterSummary(
                cluster.clusterId(),
                cluster.mapId(),
                roomIds,
                roomNames,
                layout == null ? List.of() : layout.corridorIdsForRooms(roomIdSet),
                cluster.center().x(),
                cluster.center().y(),
                active);
    }

    public static DungeonCorridorSummary corridorSummary(DungeonLayout layout, DungeonCorridor corridor, boolean active) {
        if (corridor == null) {
            return null;
        }
        List<Long> roomIds = corridor.roomIds();
        List<String> roomNames = roomIds.stream()
                .map(roomId -> {
                    DungeonRoom room = layout == null ? null : layout.findRoom(roomId);
                    return room == null ? "Raum " + roomId : room.name();
                })
                .toList();
        return new DungeonCorridorSummary(
                corridor.corridorId(),
                corridor.mapId(),
                roomIds,
                roomNames,
                active);
    }

    public static String corridorLabel(DungeonCorridorSummary summary) {
        if (summary == null) {
            return null;
        }
        return String.join(", ", summary.roomNames());
    }

    public static Node buildRoomNode(DungeonRoomSummary summary) {
        VBox box = new VBox(6);
        box.setPadding(new Insets(12));
        Label kind = new Label("Dungeon-Raum");
        kind.getStyleClass().addAll("section-header", "text-muted");
        box.getChildren().addAll(
                kind,
                secondary("Dungeon-ID: " + valueOrDash(summary.mapId() == null ? null : String.valueOf(summary.mapId()))),
                secondary("Raum-ID: " + summary.roomId()),
                secondary("Zentrum: " + summary.centerX() + "/" + summary.centerY()),
                secondary("Polygonpunkte: " + Math.max(0, summary.relativeVertexCount())),
                secondary(summary.active() ? "Aktiver Raum" : "Nicht aktiv"));
        return box;
    }

    public static Node buildClusterNode(DungeonRoomClusterSummary summary) {
        VBox box = new VBox(6);
        box.setPadding(new Insets(12));
        Label kind = new Label("Dungeon-Cluster");
        kind.getStyleClass().addAll("section-header", "text-muted");
        box.getChildren().addAll(
                kind,
                secondary("Dungeon-ID: " + valueOrDash(summary.mapId() == null ? null : String.valueOf(summary.mapId()))),
                secondary("Cluster-ID: " + summary.clusterId()),
                secondary("Zentrum: " + summary.centerX() + "/" + summary.centerY()),
                secondary("Räume: " + String.join(", ", summary.roomNames())),
                secondary("Korridore: " + (summary.corridorIds().isEmpty()
                        ? "-"
                        : summary.corridorIds().stream().map(String::valueOf).collect(Collectors.joining(", ")))),
                secondary(summary.active() ? "Aktiver Cluster" : "Nicht aktiv"));
        return box;
    }

    private static Label secondary(String text) {
        Label label = new Label(text);
        label.getStyleClass().add("text-secondary");
        label.setWrapText(true);
        return label;
    }

    private static String valueOrDash(String value) {
        return value == null || value.isBlank() ? "—" : value;
    }
}
