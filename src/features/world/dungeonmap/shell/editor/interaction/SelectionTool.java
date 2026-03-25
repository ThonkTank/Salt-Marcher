package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.room.DungeonClusterMoveService;
import features.world.dungeonmap.application.room.DungeonRoomNarrationService;
import features.world.dungeonmap.application.room.RoomExitCatalog;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.room.RoomExitNarration;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.shell.editor.EditorCards;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorInteractionState;
import features.world.dungeonmap.state.EditorPreview;
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
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class SelectionTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonClusterMoveService clusterMoveService;
    private final DungeonRoomNarrationService roomNarrationService;
    private final DungeonGridHitTester hitTester;
    private final EditorInteractionState state;
    private final VBox narrationContent = new VBox(8);
    private final VBox narrationCard = EditorCards.card("Raumbeschreibung", narrationContent);
    private final Map<Long, Button> narrationSaveButtons = new LinkedHashMap<>();
    private final Map<Long, Label> narrationStatusLabels = new LinkedHashMap<>();

    private ClusterDragSession dragSession;
    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };

    public SelectionTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonClusterMoveService clusterMoveService,
            DungeonRoomNarrationService roomNarrationService,
            DungeonGridHitTester hitTester,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.clusterMoveService = Objects.requireNonNull(clusterMoveService, "clusterMoveService");
        this.roomNarrationService = Objects.requireNonNull(roomNarrationService, "roomNarrationService");
        this.hitTester = Objects.requireNonNull(hitTester, "hitTester");
        this.state = Objects.requireNonNull(state, "state");
        this.state.addListener(this::refreshStatePane);
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
        clear();
        refreshStatePane();
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (event == null || !event.isPrimaryButton()) {
            clear();
            return false;
        }
        DungeonEditorHitTarget hit = hitTester.hitTest(ctx.projectedLayout(), event.canvasPoint(), event.camera());
        clear();
        if (isClusterLabelHit(hit)) {
            state.selectTarget(hit.targetKey());
            dragSession = ClusterDragSession.start(
                    hit.clusterId(),
                    hit.targetKey(),
                    mapState.activeMap(),
                    event.gridCell(),
                    mapState.activeProjectionLevel());
            return true;
        }
        DungeonStair stair = stairAt(event.gridCell());
        if (stair != null) {
            state.selectTarget(stair.targetKey());
            return true;
        }
        DungeonTransition transition = transitionAt(event.gridCell());
        if (transition != null) {
            state.selectTarget(transition.targetKey());
            return true;
        }
        if (hit != null) {
            state.selectTarget(hit.targetKey());
            return true;
        }
        state.clearSelection();
        return false;
    }

    @Override
    public boolean dragged(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (dragSession == null || event == null || !event.isPrimaryButtonDown()) {
            return false;
        }
        Point2i delta = event.gridCell().subtract(dragSession.pressCell());
        if (Objects.equals(delta, dragSession.currentDelta())) {
            return true;
        }
        dragSession = dragSession.withCurrentDelta(delta);
        state.showPreview(new EditorPreview.LayoutPreview(previewMap()));
        return true;
    }

    @Override
    public boolean released(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (dragSession == null || event == null) {
            return false;
        }
        Point2i delta = event.gridCell().subtract(dragSession.pressCell());
        int levelDelta = dragSession.currentLevel() - dragSession.startLevel();
        Long mapId = dragSession.baseMap().mapId() > 0 ? dragSession.baseMap().mapId() : null;
        Long clusterId = dragSession.clusterId();
        state.selectTarget(dragSession.targetKey());
        state.clearPreview();
        dragSession = null;
        if (mapId != null && clusterId != null && (delta.x() != 0 || delta.y() != 0 || levelDelta != 0)) {
            UiAsyncTasks.submitVoid(
                    () -> clusterMoveService.move(mapId, clusterId, delta, levelDelta),
                    () -> loadingService.reload(mapId),
                    throwable -> UiErrorReporter.reportBackgroundFailure("SelectionTool.released()", throwable));
        }
        return true;
    }

    @Override
    public void levelScrolled(int delta) {
        if (dragSession == null || delta == 0) {
            return;
        }
        int nextLevel = dragSession.currentLevel() + delta;
        dragSession = dragSession.withCurrentLevel(nextLevel);
        state.showPreview(new EditorPreview.LayoutPreview(previewMap()));
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
                    UiErrorReporter.reportBackgroundFailure("SelectionTool.saveRoomNarration()", throwable);
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
        String targetKey = state.selectedTargetKey();
        if (!RoomCluster.isTargetKey(targetKey)) {
            return null;
        }
        return mapState.activeMap().findCluster(RoomCluster.clusterIdFromKey(targetKey));
    }

    private Room selectedRoom() {
        String targetKey = state.selectedTargetKey();
        if (!Room.isTargetKey(targetKey)) {
            return null;
        }
        return mapState.activeMap().findRoom(Room.roomIdFromKey(targetKey));
    }

    private void clear() {
        dragSession = null;
        state.clearPreview();
    }

    private static boolean isClusterLabelHit(DungeonEditorHitTarget target) {
        return target != null
                && target.clusterId() != null
                && RoomCluster.isTargetKey(target.targetKey());
    }

    private DungeonStair stairAt(Point2i cell) {
        return mapState.activeMap().stairsAtCell(cell, mapState.activeProjectionLevel()).stream()
                .filter(candidate -> candidate != null && candidate.stairId() != null)
                .findFirst()
                .orElse(null);
    }

    private DungeonTransition transitionAt(Point2i cell) {
        return mapState.activeMap().transitionsAtCell(cell, mapState.activeProjectionLevel()).stream()
                .filter(candidate -> candidate != null && candidate.transitionId() != null)
                .findFirst()
                .orElse(null);
    }

    private DungeonLayout previewMap() {
        if (dragSession == null) {
            return null;
        }
        return dragSession.baseMap().translateCluster(
                dragSession.clusterId(),
                dragSession.currentDelta(),
                dragSession.currentLevel() - dragSession.startLevel()).layout();
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

    private record ClusterDragSession(
            Long clusterId,
            String targetKey,
            DungeonLayout baseMap,
            Point2i pressCell,
            Point2i currentDelta,
            int startLevel,
            int currentLevel
    ) {
        private ClusterDragSession withCurrentDelta(Point2i delta) {
            return new ClusterDragSession(clusterId, targetKey, baseMap, pressCell, delta, startLevel, currentLevel);
        }

        private ClusterDragSession withCurrentLevel(int nextLevel) {
            return new ClusterDragSession(clusterId, targetKey, baseMap, pressCell, currentDelta, startLevel, nextLevel);
        }

        private static ClusterDragSession start(
                Long clusterId,
                String targetKey,
                DungeonLayout baseMap,
                Point2i pressCell,
                int startLevel
        ) {
            return new ClusterDragSession(clusterId, targetKey, baseMap, pressCell, new Point2i(0, 0), startLevel, startLevel);
        }
    }
}
