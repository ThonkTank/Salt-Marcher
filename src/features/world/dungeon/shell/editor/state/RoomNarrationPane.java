package features.world.dungeon.shell.editor.state;

import features.world.dungeon.dungeonmap.application.DungeonMapLoadingService;
import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.dungeonmap.cluster.model.Cluster;
import features.world.dungeon.dungeonmap.connections.input.ConnectionEndpoint;
import features.world.dungeon.dungeonmap.connections.input.DoorExitCatalog;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.dungeonmap.state.DungeonMapState;
import features.world.dungeon.room.RoomObject;
import features.world.dungeon.room.input.SaveNarrationInput;
import features.world.dungeon.state.EditorInteractionState;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.layout.VBox;
import ui.async.UiErrorReporter;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Shared room narration editor for the current semantic room selection.
 *
 * <p>Room narration UI stays centralized here so selection tooling can expose narration editing without embedding a
 * second copy of the form logic.</p>
 */
public final class RoomNarrationPane {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final RoomObject roomObject;
    private final EditorInteractionState editorState;
    private final VBox narrationContent = new VBox(8);
    private final VBox narrationCard = editorCard("Raumbeschreibung", narrationContent);
    private final Map<Long, Button> narrationSaveButtons = new LinkedHashMap<>();
    private final Map<Long, Label> narrationStatusLabels = new LinkedHashMap<>();

    public RoomNarrationPane(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            RoomObject roomObject,
            EditorInteractionState editorState
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.roomObject = Objects.requireNonNull(roomObject, "roomObject");
        this.editorState = Objects.requireNonNull(editorState, "editorState");
    }

    public Node content() {
        List<RoomNarrationCard> cards = narrationCards();
        if (cards.isEmpty()) {
            clearNarrationContent();
            return null;
        }
        rebuildNarrationContent(cards);
        return narrationCard;
    }

    private List<RoomNarrationCard> narrationCards() {
        DungeonMap layout = mapState.activeMap();
        Room room = selectedRoom(layout, editorState.selectedRef());
        if (room != null) {
            return List.of(roomNarrationCard(layout, room));
        }
        Cluster cluster = layout.clusterOnLevel(editorState.selectedRef(), mapState.activeProjectionLevel());
        if (cluster == null) {
            return List.of();
        }
        return cluster.roomTopology().rooms().stream()
                .filter(Objects::nonNull)
                .sorted(Comparator
                        .comparing(Room::name, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                        .thenComparing(Room::roomId, Comparator.nullsLast(Long::compareTo)))
                .map(roomCard -> roomNarrationCard(layout, roomCard))
                .toList();
    }

    private RoomNarrationCard roomNarrationCard(DungeonMap layout, Room room) {
        Cluster cluster = room == null ? null : layout.findCluster(room.clusterId());
        return new RoomNarrationCard(
                room.roomId() == null ? 0L : room.roomId(),
                room.name(),
                room.narration().visualDescription(),
                describeRoomExits(layout, cluster, room).stream()
                        .map(exit -> new RoomExitCard(
                                exit.label(),
                                exit.levelZ(),
                                exit.localCell(),
                                exit.direction(),
                                room.narration().exitDescription(exit.levelZ(), exit.localCell(), exit.direction())))
                        .toList());
    }

    private void rebuildNarrationContent(List<RoomNarrationCard> cards) {
        narrationContent.getChildren().clear();
        narrationSaveButtons.clear();
        narrationStatusLabels.clear();
        for (RoomNarrationCard card : cards) {
            narrationContent.getChildren().add(buildNarrationCardUi(card));
        }
    }

    private void clearNarrationContent() {
        narrationContent.getChildren().clear();
        narrationSaveButtons.clear();
        narrationStatusLabels.clear();
    }

    private static Room selectedRoom(DungeonMap layout, features.world.dungeon.model.interaction.DungeonSelectionRef ref) {
        if (!(layout != null && ref instanceof features.world.dungeon.model.interaction.DungeonSelectionRef.RoomRef roomRef)) {
            return null;
        }
        return findRoom(layout, roomRef.roomId());
    }

    private static Room findRoom(DungeonMap layout, Long roomId) {
        if (layout == null || roomId == null) {
            return null;
        }
        for (Cluster cluster : layout.clusters()) {
            Room room = cluster == null ? null : cluster.roomTopology().findRoom(roomId);
            if (room != null) {
                return room;
            }
        }
        return null;
    }

    private static List<features.world.dungeon.dungeonmap.connections.input.DoorExitDescriptor> describeRoomExits(
            DungeonMap layout,
            Cluster cluster,
            Room room
    ) {
        if (layout == null || cluster == null || room == null || room.roomId() == null) {
            return List.of();
        }
        return cluster.roomTopology().roomLevels(room).stream()
                .sorted()
                .flatMap(levelZ -> DoorExitCatalog.describe(
                        layout,
                        cluster.roomTopology().structureFor(room).surfaceAtLevel(levelZ).floor().cellFootprint(),
                        levelZ,
                        layout.connectionsForEndpoint(ConnectionEndpoint.room(room.roomId()))).stream())
                .toList();
    }

    private VBox buildNarrationCardUi(RoomNarrationCard card) {
        TextArea visualArea = createTextArea(card.visualDescription());
        Label visualTitle = new Label("Visueller Eindruck");
        visualTitle.getStyleClass().add("text-muted");

        VBox roomBox = new VBox(6, visualTitle, visualArea);
        List<TextArea> exitAreas = new ArrayList<>();
        for (RoomExitCard exit : card.exits()) {
            Label exitTitle = new Label(exit.label());
            exitTitle.getStyleClass().add("text-muted");
            TextArea exitArea = createTextArea(exit.description());
            exitAreas.add(exitArea);
            roomBox.getChildren().addAll(exitTitle, exitArea);
        }

        Label statusLabel = new Label();
        statusLabel.setWrapText(true);
        Button saveButton = new Button("Speichern");
        narrationSaveButtons.put(card.roomId(), saveButton);
        narrationStatusLabels.put(card.roomId(), statusLabel);
        saveButton.setOnAction(event -> saveRoomNarration(card, visualArea, exitAreas));
        roomBox.getChildren().addAll(statusLabel, saveButton);
        return editorCard(card.roomName(), roomBox);
    }

    private void saveRoomNarration(RoomNarrationCard card, TextArea visualArea, List<TextArea> exitAreas) {
        if (card.roomId() <= 0) {
            return;
        }
        List<SaveNarrationInput.ExitNarrationInput> exitNarrations = new ArrayList<>();
        for (int index = 0; index < card.exits().size(); index++) {
            RoomExitCard exit = card.exits().get(index);
            exitNarrations.add(new SaveNarrationInput.ExitNarrationInput(
                    exit.levelZ(),
                    roomCellX(exit.roomCell()),
                    roomCellY(exit.roomCell()),
                    roomCellZ(exit.roomCell()),
                    directionName(exit.direction()),
                    exitAreas.get(index).getText()));
        }
        setRoomNarrationSaveState(card.roomId(), true, "Speichert...");
        loadingService.submitMutation(
                () -> {
                    roomObject.saveNarration(new SaveNarrationInput(card.roomId(), visualArea.getText(), exitNarrations));
                    return mapState.activeMapId();
                },
                updatedMapId -> updatedMapId,
                ignored -> setRoomNarrationSaveState(card.roomId(), false, "Gespeichert"),
                throwable -> {
                    UiErrorReporter.reportBackgroundFailure("RoomNarrationPane.saveRoomNarration()", throwable);
                    setRoomNarrationSaveState(card.roomId(), false, "Raumbeschreibung konnte nicht gespeichert werden.");
                });
    }

    private void setRoomNarrationSaveState(long roomId, boolean busy, String status) {
        Button saveButton = narrationSaveButtons.get(roomId);
        if (saveButton != null) {
            saveButton.setDisable(busy);
            saveButton.setText(busy ? "Speichert..." : "Speichern");
        }
        Label statusLabel = narrationStatusLabels.get(roomId);
        if (statusLabel != null) {
            statusLabel.setText(status == null ? "" : status);
        }
    }

    private static TextArea createTextArea(String text) {
        TextArea area = new TextArea(text == null ? "" : text);
        area.setWrapText(true);
        area.setPrefRowCount(3);
        return area;
    }

    private static int roomCellX(GridPoint roomCell) {
        return roomCell == null ? 0 : roomCell.x2() / 2;
    }

    private static int roomCellY(GridPoint roomCell) {
        return roomCell == null ? 0 : roomCell.y2() / 2;
    }

    private static int roomCellZ(GridPoint roomCell) {
        return roomCell == null ? 0 : roomCell.z();
    }

    private static String directionName(CardinalDirection direction) {
        return (direction == null ? CardinalDirection.defaultDirection() : direction).name();
    }

    private static VBox editorCard(String title, Node... content) {
        Label titleLabel = new Label(title);
        titleLabel.getStyleClass().add("editor-panel-title");
        VBox box = new VBox(6);
        box.getStyleClass().add("editor-card");
        box.getChildren().add(titleLabel);
        box.getChildren().addAll(content);
        return box;
    }

    private record RoomNarrationCard(
            long roomId,
            String roomName,
            String visualDescription,
            List<RoomExitCard> exits
    ) {
    }

    private record RoomExitCard(
            String label,
            int levelZ,
            GridPoint roomCell,
            CardinalDirection direction,
            String description
    ) {
    }
}
