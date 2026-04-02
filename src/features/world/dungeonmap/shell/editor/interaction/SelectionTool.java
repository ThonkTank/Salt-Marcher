package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.corridor.DungeonCorridorEditService;
import features.world.dungeonmap.application.corridor.DungeonCorridorGraphEditor;
import features.world.dungeonmap.application.room.DungeonClusterMoveService;
import features.world.dungeonmap.application.room.DungeonClusterMoveProjectionApplicationService;
import features.world.dungeonmap.application.room.DungeonRoomNarrationService;
import features.world.dungeonmap.application.room.RoomExitCatalog;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.LegacyGridPoint2x;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.room.RoomExitNarration;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.shell.editor.EditorCards;
import features.world.dungeonmap.shell.interaction.DungeonHitConventions;
import features.world.dungeonmap.shell.interaction.DungeonHitKind;
import features.world.dungeonmap.shell.interaction.DungeonHitSubject;
import features.world.dungeonmap.shell.interaction.DungeonSelectionKey;
import features.world.dungeonmap.shell.interaction.DungeonSelectionLookup;
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
    private final DungeonClusterMoveProjectionApplicationService clusterMoveProjectionApplicationService;
    private final DungeonCorridorEditService corridorEditService;
    private final DungeonRoomNarrationService roomNarrationService;
    private final EditorInteractionState state;
    private final VBox narrationContent = new VBox(8);
    private final VBox narrationCard = EditorCards.card("Raumbeschreibung", narrationContent);
    private final Map<Long, Button> narrationSaveButtons = new LinkedHashMap<>();
    private final Map<Long, Label> narrationStatusLabels = new LinkedHashMap<>();

    private ClusterDragSession dragSession;
    private CorridorNodeDragSession corridorNodeDragSession;
    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };

    public SelectionTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonClusterMoveService clusterMoveService,
            DungeonClusterMoveProjectionApplicationService clusterMoveProjectionApplicationService,
            DungeonCorridorEditService corridorEditService,
            DungeonRoomNarrationService roomNarrationService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.clusterMoveService = Objects.requireNonNull(clusterMoveService, "clusterMoveService");
        this.clusterMoveProjectionApplicationService = Objects.requireNonNull(
                clusterMoveProjectionApplicationService,
                "clusterMoveProjectionApplicationService");
        this.corridorEditService = Objects.requireNonNull(corridorEditService, "corridorEditService");
        this.roomNarrationService = Objects.requireNonNull(roomNarrationService, "roomNarrationService");
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
        DungeonHitSubject hit = ctx == null ? null : ctx.resolvedSubject();
        DungeonSelectionKey resolvedSelectionKey = ctx == null ? null : ctx.resolvedSelectionKey();
        clear();
        if (hit instanceof DungeonHitSubject.CorridorNodeSubject corridorNodeHit
                && corridorNodeHit.corridorId() != null
                && corridorNodeHit.nodeId() != null) {
            state.selectKey(resolvedSelectionKey);
            corridorNodeDragSession = new CorridorNodeDragSession(
                    corridorNodeHit.corridorId(),
                    corridorNodeHit.nodeId(),
                    corridorNodeHit.point2x(),
                    corridorNodeHit.point2x());
            return true;
        }
        if (hit instanceof DungeonHitSubject.ClusterLabelSubject clusterLabelHit) {
            state.selectKey(resolvedSelectionKey);
            dragSession = ClusterDragSession.start(
                    clusterLabelHit.clusterId(),
                    mapState.activeMap(),
                    event.gridCell(),
                    mapState.activeProjectionLevel());
            return true;
        }
        if (hit instanceof DungeonHitSubject.StairSubject) {
            state.selectKey(resolvedSelectionKey);
            return true;
        }
        if (hit instanceof DungeonHitSubject.TransitionSubject) {
            state.selectKey(resolvedSelectionKey);
            return true;
        }
        if (hit != null && !hit.targetKey().isBlank()) {
            state.selectKey(resolvedSelectionKey);
            return true;
        }
        state.clearSelection();
        return false;
    }

    @Override
    public boolean dragged(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (corridorNodeDragSession != null) {
            if (event == null || !event.isPrimaryButtonDown()) {
                return false;
            }
            LegacyGridPoint2x point2x = ctx == null || ctx.probe() == null
                    ? LegacyGridPoint2x.fromTileCenter(event.gridCell())
                    : ctx.probe().probePoint2x();
            if (Objects.equals(point2x, corridorNodeDragSession.currentPoint())) {
                return true;
            }
            corridorNodeDragSession = corridorNodeDragSession.withCurrentPoint(point2x);
            state.showPreview(new EditorPreview.LayoutPreview(previewCorridorMap()));
            return true;
        }
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
        if (corridorNodeDragSession != null) {
            CorridorNodeDragSession current = corridorNodeDragSession;
            corridorNodeDragSession = null;
            state.clearPreview();
            if (!Objects.equals(current.startPoint(), current.currentPoint()) && mapState.activeMapId() != null) {
                Corridor corridor = mapState.activeMap().findCorridor(current.corridorId());
                if (corridor != null) {
                    Corridor updated = DungeonCorridorGraphEditor.withMovedNode(
                            mapState.activeMap(),
                            corridor,
                            current.nodeId(),
                            current.currentPoint());
                    loadingService.submitReloadingWrite(
                            () -> corridorEditService.update(mapState.activeMapId(), updated),
                            mapState.activeMapId(),
                            () -> state.selectKey(corridorNodeKey(current.corridorId(), current.nodeId())),
                            throwable -> UiErrorReporter.reportBackgroundFailure("SelectionTool.released()", throwable));
                }
            }
            return true;
        }
        if (dragSession == null || event == null) {
            return false;
        }
        Point2i delta = event.gridCell().subtract(dragSession.pressCell());
        int levelDelta = dragSession.currentLevel() - dragSession.startLevel();
        Long mapId = dragSession.baseMap().mapId() > 0 ? dragSession.baseMap().mapId() : null;
        Long clusterId = dragSession.clusterId();
        state.clearPreview();
        dragSession = null;
        if (mapId != null && clusterId != null && (delta.x() != 0 || delta.y() != 0 || levelDelta != 0)) {
            loadingService.submitReloadingWrite(
                    () -> clusterMoveService.move(mapId, clusterId, delta, levelDelta),
                    mapId,
                    null,
                    throwable -> UiErrorReporter.reportBackgroundFailure("SelectionTool.released()", throwable));
        }
        return true;
    }

    @Override
    public EditorHitResolution resolveHit(EditorToolContext ctx, EditorToolPhase phase) {
        if (activeTool != DungeonEditorTool.SELECT) {
            return EditorHitResolution.none();
        }
        DungeonHitSubject subject = resolvedSubject(ctx == null ? null : ctx.selection());
        if (subject == null) {
            return EditorHitResolution.none();
        }
        if (subject instanceof DungeonHitSubject.CorridorNodeSubject) {
            return EditorHitResolution.part(subject);
        }
        return EditorHitResolution.owner(subject);
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
                                exit.levelZ(),
                                exit.roomCell(),
                                exit.direction(),
                                room.narration().exitDescription(exit.levelZ(), exit.roomCell(), exit.direction())))
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
            exitNarrations.add(new RoomExitNarration(exit.levelZ(), exit.roomCell(), exit.direction(), exitAreas.get(index).getText()));
        }
        setRoomNarrationSaveState(card.roomId(), true, "Speichert...");
        loadingService.submitReloadingWrite(
                () -> roomNarrationService.saveNarration(card.roomId(), new RoomNarration(visualArea.getText(), exitNarrations)),
                mapState.activeMapId(),
                () -> {
                    setRoomNarrationSaveState(card.roomId(), false, "Gespeichert");
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
        return DungeonSelectionLookup.clusterOnLevel(
                mapState.activeMap(),
                state.selectedKey(),
                mapState.activeProjectionLevel());
    }

    private Room selectedRoom() {
        return DungeonSelectionLookup.room(mapState.activeMap(), state.selectedKey());
    }

    private void clear() {
        dragSession = null;
        corridorNodeDragSession = null;
        state.clearPreview();
    }

    private static DungeonHitSubject resolvedSubject(features.world.dungeonmap.shell.interaction.DungeonSelection selection) {
        if (selection == null) {
            return null;
        }
        return selection.firstSubjectMatching(SelectionTool::isRelevantSubject);
    }

    private static boolean isRelevantSubject(DungeonHitSubject subject) {
        return subject instanceof DungeonHitSubject.CorridorNodeSubject
                || subject instanceof DungeonHitSubject.ClusterLabelSubject
                || subject instanceof DungeonHitSubject.RoomSubject
                || subject instanceof DungeonHitSubject.RoomBoundarySubject
                || subject instanceof DungeonHitSubject.ConnectionSubject
                || subject instanceof DungeonHitSubject.CorridorSubject
                || subject instanceof DungeonHitSubject.StairSubject
                || subject instanceof DungeonHitSubject.TransitionSubject;
    }

    private static DungeonSelectionKey corridorNodeKey(long corridorId, Long nodeId) {
        return new DungeonSelectionKey(
                DungeonHitKind.CORRIDOR_NODE,
                Corridor.targetKey(corridorId),
                DungeonHitConventions.nodePartKey(nodeId));
    }

    private DungeonLayout previewMap() {
        if (dragSession == null) {
            return null;
        }
        return clusterMoveProjectionApplicationService.project(
                dragSession.baseMap(),
                dragSession.clusterId(),
                dragSession.currentDelta(),
                dragSession.currentLevel() - dragSession.startLevel()).layout();
    }

    private DungeonLayout previewCorridorMap() {
        if (corridorNodeDragSession == null) {
            return null;
        }
        Corridor corridor = mapState.activeMap().findCorridor(corridorNodeDragSession.corridorId());
        if (corridor == null) {
            return null;
        }
        Corridor updated = DungeonCorridorGraphEditor.withMovedNode(
                mapState.activeMap(),
                corridor,
                corridorNodeDragSession.nodeId(),
                corridorNodeDragSession.currentPoint());
        return new DungeonLayout(
                mapState.activeMap().mapId(),
                mapState.activeMap().name(),
                mapState.activeMap().corridors().stream()
                        .map(existing -> existing != null && Objects.equals(existing.corridorId(), updated.corridorId()) ? updated : existing)
                        .toList(),
                mapState.activeMap().clusters(),
                mapState.activeMap().stairs(),
                mapState.activeMap().transitions(),
                mapState.activeMap().clusters().stream()
                        .filter(cluster -> cluster != null && cluster.clusterId() != null)
                        .collect(java.util.stream.Collectors.toMap(
                                cluster -> cluster.clusterId(),
                                cluster -> mapState.activeMap().levelForCluster(cluster.clusterId()))))
                .projectedToLevel(mapState.activeProjectionLevel());
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
            Point2i roomCell,
            Point2i direction,
            String description
    ) {
    }

    private record ClusterDragSession(
            Long clusterId,
            DungeonLayout baseMap,
            Point2i pressCell,
            Point2i currentDelta,
            int startLevel,
            int currentLevel
    ) {
        private ClusterDragSession withCurrentDelta(Point2i delta) {
            return new ClusterDragSession(clusterId, baseMap, pressCell, delta, startLevel, currentLevel);
        }

        private ClusterDragSession withCurrentLevel(int nextLevel) {
            return new ClusterDragSession(clusterId, baseMap, pressCell, currentDelta, startLevel, nextLevel);
        }

        private static ClusterDragSession start(
                Long clusterId,
                DungeonLayout baseMap,
                Point2i pressCell,
                int startLevel
        ) {
            return new ClusterDragSession(clusterId, baseMap, pressCell, new Point2i(0, 0), startLevel, startLevel);
        }
    }

    private record CorridorNodeDragSession(
            long corridorId,
            Long nodeId,
            LegacyGridPoint2x startPoint,
            LegacyGridPoint2x currentPoint
    ) {
        private CorridorNodeDragSession withCurrentPoint(LegacyGridPoint2x currentPoint) {
            return new CorridorNodeDragSession(corridorId, nodeId, startPoint, currentPoint);
        }
    }
}
