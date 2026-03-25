package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.room.DungeonRoomNarrationService;
import features.world.dungeonmap.application.room.RoomExitCatalog;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.room.RoomExitNarration;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.shell.editor.EditorCards;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorSelectionState;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextArea;
import javafx.scene.layout.VBox;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Objects;
import java.util.Map;
import java.util.Set;

public final class SelectionToolHandler implements EditorToolHandler {

    private final ClusterSelectionDragController controller;
    private final DungeonMapState mapState;
    private final EditorSelectionState selectionState;
    private final DungeonRoomNarrationService roomNarrationService;
    private final DungeonMapLoadingService loadingService;
    private final VBox narrationContent = new VBox(8);
    private final VBox narrationCard = EditorCards.card("Raumbeschreibung", narrationContent);
    private final Map<Long, Button> narrationSaveButtons = new LinkedHashMap<>();
    private final Map<Long, Label> narrationStatusLabels = new LinkedHashMap<>();

    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };

    public SelectionToolHandler(
            ClusterSelectionDragController controller,
            DungeonMapState mapState,
            EditorSelectionState selectionState,
            DungeonRoomNarrationService roomNarrationService,
            DungeonMapLoadingService loadingService
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.selectionState = Objects.requireNonNull(selectionState, "selectionState");
        this.roomNarrationService = Objects.requireNonNull(roomNarrationService, "roomNarrationService");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.selectionState.addListener(this::refreshStatePane);
        this.mapState.addListener(this::refreshStatePane);
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(DungeonEditorTool.SELECT);
    }

    @Override
    public void activate(DungeonEditorTool tool) {
        activeTool = tool;
        refreshStatePane();
    }

    @Override
    public void deactivate() {
        activeTool = null;
        controller.clear();
        refreshStatePane();
    }

    @Override
    public boolean handlePressed(DungeonCanvasPointerEvent event) {
        return controller.handlePressed(event);
    }

    @Override
    public boolean handleDragged(DungeonCanvasPointerEvent event) {
        return controller.handleDragged(event);
    }

    @Override
    public boolean handleReleased(DungeonCanvasPointerEvent event) {
        return controller.handleReleased(event);
    }

    @Override
    public boolean handleLevelScroll(int levelDelta) {
        return controller.handleLevelScroll(levelDelta);
    }

    @Override
    public Node statePaneContent() {
        if (activeTool != DungeonEditorTool.SELECT) {
            return null;
        }
        List<RoomNarrationCard> cards = narrationCards();
        if (cards.isEmpty()) {
            clearNarrationContent();
            return null;
        }
        rebuildNarrationContent(cards);
        return narrationCard;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
        refreshCallback = callback == null ? () -> { } : callback;
    }

    private void refreshStatePane() {
        refreshCallback.run();
    }

    private List<RoomNarrationCard> narrationCards() {
        Room room = selectedRoom();
        if (room != null) {
            return List.of(roomNarrationCard(room));
        }
        RoomCluster cluster = selectedCluster();
        if (cluster == null) {
            return List.of();
        }
        return cluster.rooms().stream()
                .filter(Objects::nonNull)
                .sorted(Comparator
                        .comparing(Room::name, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                        .thenComparing(Room::roomId, Comparator.nullsLast(Long::compareTo)))
                .map(this::roomNarrationCard)
                .toList();
    }

    private RoomNarrationCard roomNarrationCard(Room room) {
        return new RoomNarrationCard(
                room.roomId() == null ? 0L : room.roomId(),
                room.name(),
                room.narration().visualDescription(),
                RoomExitCatalog.describe(mapState.activeMap(), room).stream()
                        .map(exit -> new RoomExitCard(
                                exit.label(),
                                exit.roomCell(),
                                exit.direction(),
                                room.narration().exitDescription(exit.roomCell(), exit.direction())))
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
            exitNarrations.add(new RoomExitNarration(exit.roomCell(), exit.direction(), exitAreas.get(index).getText()));
        }
        setRoomNarrationSaveState(card.roomId(), true, "Speichert...");
        UiAsyncTasks.submitVoid(
                () -> roomNarrationService.saveNarration(card.roomId(), new RoomNarration(visualArea.getText(), exitNarrations)),
                () -> {
                    setRoomNarrationSaveState(card.roomId(), false, "Gespeichert");
                    loadingService.reload(mapState.activeMapId());
                },
                throwable -> {
                    UiErrorReporter.reportBackgroundFailure("SelectionToolHandler.saveRoomNarration()", throwable);
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

    private RoomCluster selectedCluster() {
        String targetKey = selectionState.selectedTargetKey();
        if (!RoomCluster.isTargetKey(targetKey)) {
            return null;
        }
        return mapState.activeMap().findCluster(RoomCluster.clusterIdFromKey(targetKey));
    }

    private Room selectedRoom() {
        String targetKey = selectionState.selectedTargetKey();
        if (!Room.isTargetKey(targetKey)) {
            return null;
        }
        return mapState.activeMap().findRoom(Room.roomIdFromKey(targetKey));
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
            Point2i roomCell,
            Point2i direction,
            String description
    ) {
    }
}
