package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.application.room.DungeonRoomApplicationService;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.geometry.CardinalDirection;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.cluster.model.RoomCluster;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.DoorExitCatalog;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.room.RoomExitNarration;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorInteractionState;
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
    private final DungeonRoomApplicationService roomApplicationService;
    private final EditorInteractionState editorState;
    private final VBox narrationContent = new VBox(8);
    private final VBox narrationCard = EditorCards.card("Raumbeschreibung", narrationContent);
    private final Map<Long, Button> narrationSaveButtons = new LinkedHashMap<>();
    private final Map<Long, Label> narrationStatusLabels = new LinkedHashMap<>();

    public RoomNarrationPane(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonRoomApplicationService roomApplicationService,
            EditorInteractionState editorState
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.roomApplicationService = Objects.requireNonNull(roomApplicationService, "roomApplicationService");
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
        DungeonLayout layout = mapState.activeMap();
        Room room = selectedRoom(layout, editorState.selectedRef());
        if (room != null) {
            return List.of(roomNarrationCard(layout, room));
        }
        RoomCluster cluster = layout.clusterOnLevel(editorState.selectedRef(), mapState.activeProjectionLevel());
        if (cluster == null) {
            return List.of();
        }
        return cluster.structure().roomTopology().rooms().stream()
                .filter(Objects::nonNull)
                .sorted(Comparator
                        .comparing(Room::name, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                        .thenComparing(Room::roomId, Comparator.nullsLast(Long::compareTo)))
                .map(roomCard -> roomNarrationCard(layout, roomCard))
                .toList();
    }

    private RoomNarrationCard roomNarrationCard(DungeonLayout layout, Room room) {
        RoomCluster cluster = room == null ? null : layout.findCluster(room.clusterId());
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

    private static Room selectedRoom(DungeonLayout layout, features.world.dungeonmap.model.interaction.DungeonSelectionRef ref) {
        if (!(layout != null && ref instanceof features.world.dungeonmap.model.interaction.DungeonSelectionRef.RoomRef roomRef)) {
            return null;
        }
        return findRoom(layout, roomRef.roomId());
    }

    private static Room findRoom(DungeonLayout layout, Long roomId) {
        if (layout == null || roomId == null) {
            return null;
        }
        for (RoomCluster cluster : layout.clusters()) {
            Room room = cluster == null ? null : cluster.structure().roomTopology().findRoom(roomId);
            if (room != null) {
                return room;
            }
        }
        return null;
    }

    private static List<features.world.dungeonmap.model.structures.connection.DoorExitDescriptor> describeRoomExits(
            DungeonLayout layout,
            RoomCluster cluster,
            Room room
    ) {
        if (layout == null || cluster == null || room == null || room.roomId() == null) {
            return List.of();
        }
        return cluster.structure().roomTopology().roomLevels(room).stream()
                .sorted()
                .flatMap(levelZ -> DoorExitCatalog.describe(
                        layout,
                        cluster.structure().roomTopology().structureFor(room).surfaceAtLevel(levelZ).floor().cellCoords(),
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
        return EditorCards.card(card.roomName(), roomBox);
    }

    private void saveRoomNarration(RoomNarrationCard card, TextArea visualArea, List<TextArea> exitAreas) {
        if (card.roomId() <= 0) {
            return;
        }
        ArrayList<RoomExitNarration> exitNarrations = new ArrayList<>();
        for (int index = 0; index < card.exits().size(); index++) {
            RoomExitCard exit = card.exits().get(index);
            exitNarrations.add(new RoomExitNarration(exit.levelZ(), exit.roomCell(), exit.direction(), exitAreas.get(index).getText()));
        }
        setRoomNarrationSaveState(card.roomId(), true, "Speichert...");
        loadingService.submitMutation(
                () -> {
                    roomApplicationService.saveNarration(card.roomId(), new RoomNarration(visualArea.getText(), exitNarrations));
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
