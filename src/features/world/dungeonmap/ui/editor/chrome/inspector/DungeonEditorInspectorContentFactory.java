package features.world.dungeonmap.ui.editor.chrome.inspector;

import features.world.dungeonmap.model.domain.DungeonConnection;
import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonAreaEncounterTableLink;
import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureTile;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.projection.index.DungeonMapIndex;
import features.world.dungeonmap.model.projection.index.DungeonRoomConnectionSummary;
import features.world.dungeonmap.service.room.DungeonRoomConnectionRoutes;
import features.world.dungeonmap.ui.shared.format.DungeonAreaEncounterText;
import features.world.dungeonmap.ui.shared.format.DungeonRoomDetailRenderer;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.layout.VBox;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class DungeonEditorInspectorContentFactory {

    private final DungeonEditorState state;
    private final DungeonEntityInspectorActions entityActions;

    public DungeonEditorInspectorContentFactory(
            DungeonEditorState state,
            DungeonEntityInspectorActions entityActions
    ) {
        this.state = state;
        this.entityActions = entityActions;
    }

    public Node buildRoomCard(DungeonRoom room) {
        VBox box = DungeonInspectorCards.card();
        if (room == null) {
            box.getChildren().add(DungeonInspectorCards.secondary("Raum nicht gefunden."));
            return box;
        }
        DungeonRoomDetailRenderer.appendStructuredDetails(box, currentIndex(), room, resolveAreaName(room.areaId()));
        appendRoomConnectionSection(box, room.roomId());
        return box;
    }

    public Node buildAreaCard(DungeonArea area) {
        VBox box = DungeonInspectorCards.card();
        if (area == null) {
            box.getChildren().add(DungeonInspectorCards.secondary("Bereich nicht gefunden."));
            return box;
        }

        List<DungeonRoom> rooms = roomsForArea(area.areaId());
        box.getChildren().addAll(
                DungeonInspectorCards.secondary("Name: " + DungeonInspectorCards.valueOrDash(area.name())),
                DungeonInspectorCards.secondary("Encounter-Rhythmus: " + DungeonAreaEncounterText.formatCadence(area.encounterEveryHours())),
                DungeonInspectorCards.secondary("Räume: " + rooms.size()));
        DungeonInspectorCards.appendListSection(box, "Encounter-Tabellen", describeEncounterTables(area.encounterTableLinks()));
        DungeonInspectorCards.appendListSection(box, "Räume", describeRooms(rooms));
        return box;
    }

    public Node buildFeatureCard(DungeonFeature feature) {
        VBox box = DungeonInspectorCards.card();
        if (feature == null) {
            box.getChildren().add(DungeonInspectorCards.secondary("Feature nicht gefunden."));
            return box;
        }
        DungeonRoom room = resolveOwningRoom(feature);
        if (room != null) {
            DungeonRoomDetailRenderer.appendStructuredDetails(box, currentIndex(), room, resolveAreaName(room.areaId()));
            return box;
        }
        box.getChildren().add(DungeonInspectorCards.secondary("Dieses Feature ist aktuell keinem Raum zugeordnet."));
        List<DungeonFeatureTile> tiles = featureTiles(feature.featureId());
        box.getChildren().add(DungeonInspectorCards.secondary("Felder: " + tiles.size()));
        DungeonInspectorCards.appendListSection(box, "Positionen", describeFeatureTiles(tiles));
        DungeonInspectorCards.appendListSection(box, "Räume", describeFeatureRooms(tiles));
        return box;
    }

    public Node buildConnectionCard(DungeonConnection connection) {
        VBox box = DungeonInspectorCards.card();
        if (connection == null) {
            box.getChildren().add(DungeonInspectorCards.secondary("Verbindung nicht gefunden."));
            return box;
        }
        DungeonRoom leftRoom = resolveConnectionRoom(connection.leftNodeKey());
        DungeonRoom rightRoom = resolveConnectionRoom(connection.rightNodeKey());
        box.getChildren().addAll(
                DungeonInspectorCards.secondary("Von: " + DungeonInspectorCards.titleOrFallback(leftRoom == null ? null : leftRoom.name(), connection.leftNodeKey())),
                DungeonInspectorCards.secondary("Nach: " + DungeonInspectorCards.titleOrFallback(rightRoom == null ? null : rightRoom.name(), connection.rightNodeKey())),
                DungeonInspectorCards.secondary("Knoten: " + describeConnectionPointCount(connection.connectionId())));
        return box;
    }

    private void appendRoomConnectionSection(VBox parent, Long roomId) {
        List<DungeonRoomConnectionSummary> connections = roomConnections(roomId);
        if (connections.isEmpty()) {
            return;
        }
        List<String> lines = new ArrayList<>();
        for (DungeonRoomConnectionSummary connection : connections) {
            DungeonRoom counterpart = currentIndex().findRoom(connection.counterpartRoomId());
            lines.add(DungeonInspectorCards.titleOrFallback(counterpart == null ? null : counterpart.name(), "Verbindung")
                    + " • " + describeConnectionPointCount(connection.connectionId()));
        }
        DungeonInspectorCards.appendListSection(parent, "Verbindungen", lines);
    }

    public Node buildRoomFooter(DungeonRoom room) {
        if (room == null || room.roomId() == null) {
            return null;
        }
        VBox footer = new VBox();
        footer.getStyleClass().add("dungeon-room-inspector-footer");
        Button button = new Button("Voll bearbeiten");
        button.getStyleClass().addAll("accent", "dungeon-room-inspector-footer-button");
        button.setMaxWidth(Double.MAX_VALUE);
        button.setOnAction(event -> entityActions.openRoomEditor(button, room.roomId()));
        footer.getChildren().add(button);
        return footer;
    }

    public Node buildFeatureFooter(DungeonFeature feature) {
        if (feature == null || feature.featureId() == null) {
            return null;
        }
        VBox footer = new VBox();
        footer.getStyleClass().add("dungeon-room-inspector-footer");
        Button button = new Button("Voll bearbeiten");
        button.getStyleClass().addAll("accent", "dungeon-room-inspector-footer-button");
        button.setMaxWidth(Double.MAX_VALUE);
        button.setOnAction(event -> entityActions.openFeatureEditor(button, feature.featureId()));
        footer.getChildren().add(button);
        return footer;
    }

    private List<DungeonSquare> roomSquares(Long roomId) {
        return currentIndex().squaresForRoom(roomId);
    }

    private List<DungeonRoom> roomsForArea(Long areaId) {
        return currentIndex().roomsForArea(areaId);
    }

    private List<DungeonFeatureTile> featureTiles(Long featureId) {
        return currentIndex().featureTilesForFeature(featureId);
    }

    private List<DungeonRoomConnectionSummary> roomConnections(Long roomId) {
        return currentIndex().roomConnectionsForRoom(roomId);
    }

    public DungeonRoom resolveOwningRoom(DungeonFeature feature) {
        if (feature == null || feature.featureId() == null) {
            return null;
        }
        Map<Long, Integer> roomTileCounts = new LinkedHashMap<>();
        for (DungeonFeatureTile tile : featureTiles(feature.featureId())) {
            DungeonSquare square = currentIndex().findSquare(tile.squareId());
            if (square == null || square.roomId() == null) {
                continue;
            }
            roomTileCounts.merge(square.roomId(), 1, Integer::sum);
        }
        return roomTileCounts.entrySet().stream()
                .sorted(Map.Entry.<Long, Integer>comparingByValue(Comparator.reverseOrder())
                        .thenComparing(Map.Entry::getKey))
                .map(entry -> currentIndex().findRoom(entry.getKey()))
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    private List<String> describeRooms(List<DungeonRoom> rooms) {
        List<String> lines = new ArrayList<>();
        for (DungeonRoom room : rooms) {
            lines.add(DungeonInspectorCards.titleOrFallback(room.name(), "Raum") + " (" + roomSquares(room.roomId()).size() + " Felder)");
        }
        return lines;
    }

    private List<String> describeFeatureTiles(List<DungeonFeatureTile> tiles) {
        List<String> lines = new ArrayList<>();
        for (DungeonFeatureTile tile : tiles) {
            DungeonSquare square = currentIndex().findSquare(tile.squareId());
            String roomName = square == null ? null : square.roomName();
            lines.add(DungeonInspectorCards.formatPosition(tile.x(), tile.y())
                    + (roomName == null || roomName.isBlank() ? "" : " • " + roomName));
        }
        return lines;
    }

    private List<String> describeFeatureRooms(List<DungeonFeatureTile> tiles) {
        LinkedHashSet<String> names = new LinkedHashSet<>();
        for (DungeonFeatureTile tile : tiles) {
            DungeonSquare square = currentIndex().findSquare(tile.squareId());
            if (square != null && square.roomName() != null && !square.roomName().isBlank()) {
                names.add(square.roomName());
            }
        }
        return List.copyOf(names);
    }

    private List<String> describeEncounterTables(List<DungeonAreaEncounterTableLink> links) {
        List<String> lines = new ArrayList<>();
        for (DungeonAreaEncounterTableLink link : links == null ? List.<DungeonAreaEncounterTableLink>of() : links) {
            String tableName = "Encounter Table #" + link.tableId();
            lines.add(tableName + " • Gewicht " + link.weight());
        }
        return lines;
    }

    private String resolveAreaName(Long areaId) {
        DungeonArea area = currentIndex().findArea(areaId);
        return area == null ? null : area.name();
    }

    private DungeonRoom resolveConnectionRoom(String nodeKey) {
        Long roomId = DungeonRoomConnectionRoutes.roomIdFromNodeKey(nodeKey);
        return currentIndex().findRoom(roomId);
    }

    private String describeConnectionPointCount(Long connectionId) {
        long pointCount = state.currentState() == null ? 0 : state.currentState().connectionPoints().stream()
                .filter(point -> Objects.equals(connectionId, point.connectionId()))
                .count();
        return pointCount == 0 ? "direkt" : pointCount + " Wegpunkte";
    }

    private DungeonMapIndex currentIndex() {
        return state.index();
    }
}
