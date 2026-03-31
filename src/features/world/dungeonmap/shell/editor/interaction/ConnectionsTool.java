package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.corridor.DungeonCorridorEditService;
import features.world.dungeonmap.application.corridor.DungeonCorridorGraphEditor;
import features.world.dungeonmap.application.room.DungeonBoundaryEditService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNode;
import features.world.dungeonmap.model.structures.corridor.CorridorSegment;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import features.world.dungeonmap.shell.editor.EditorCards;
import features.world.dungeonmap.shell.interaction.DungeonHitResult;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorInteractionState;
import features.world.dungeonmap.state.EditorPreview;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import ui.async.UiErrorReporter;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

public final class ConnectionsTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final DungeonBoundaryEditService boundaryEditService;
    private final DungeonCorridorEditService corridorEditService;
    private final EditorInteractionState state;
    private final Label statusLabel = new Label();
    private final Label selectionLabel = new Label();
    private final Label connectedRoomsLabel = new Label();
    private final Button deleteNodeButton = new Button("Node löschen");
    private final Button deleteCorridorButton = new Button("Korridor löschen");
    private final VBox card = EditorCards.card("Connections", statusLabel, selectionLabel, connectedRoomsLabel, deleteNodeButton, deleteCorridorButton);

    private CorridorBuildDraft draft;
    private Long selectedNodeId;
    private Long selectedSegmentId;
    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };

    public ConnectionsTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonEditorSessionState sessionState,
            DungeonBoundaryEditService boundaryEditService,
            DungeonCorridorEditService corridorEditService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.boundaryEditService = Objects.requireNonNull(boundaryEditService, "boundaryEditService");
        this.corridorEditService = Objects.requireNonNull(corridorEditService, "corridorEditService");
        this.state = Objects.requireNonNull(state, "state");
        statusLabel.setWrapText(true);
        selectionLabel.setWrapText(true);
        connectedRoomsLabel.setWrapText(true);
        deleteNodeButton.setOnAction(event -> deleteSelectedNode());
        deleteCorridorButton.setOnAction(event -> deleteSelectedCorridor());
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(DungeonEditorTool.CONNECTIONS, DungeonEditorTool.CONNECTIONS_DELETE);
    }

    @Override
    public void activate(DungeonEditorTool tool) {
        activeTool = tool;
        refreshStatePane();
    }

    @Override
    public void deactivate() {
        activeTool = null;
        clearDraft();
        clearSubSelection();
        refreshStatePane();
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (event == null || !event.isPrimaryButton()) {
            return false;
        }
        DungeonHitResult hitResult = ctx.hitResult();
        DungeonEditorHitTarget hit = hitResult == null ? null : hitResult.editorTarget();
        if (sessionState.selectedTool() == DungeonEditorTool.CONNECTIONS_DELETE) {
            return handleDeletePressed(ctx.projectedLayout(), hit);
        }
        return handleConnectionsPressed(ctx, ctx.projectedLayout(), hit);
    }

    @Override
    public boolean dragged(EditorToolContext ctx) {
        return false;
    }

    @Override
    public boolean released(EditorToolContext ctx) {
        return false;
    }

    @Override
    public Node statePaneContent() {
        if (activeTool == null) {
            return null;
        }
        Corridor corridor = selectedCorridor();
        statusLabel.setText(draft == null ? "Kein offener Corridor-Build" : draft.statusMessage());
        if (corridor == null) {
            selectionLabel.setText("Innenwand: Tür. Außenwand: Corridor-Start.");
            connectedRoomsLabel.setText("");
            deleteNodeButton.setVisible(false);
            deleteCorridorButton.setVisible(false);
            return card;
        }
        selectionLabel.setText(selectionText(corridor));
        connectedRoomsLabel.setText(connectedRoomsText(corridor));
        deleteNodeButton.setVisible(selectedNodeId != null && corridor.findNode(selectedNodeId) != null);
        deleteCorridorButton.setVisible(corridor.corridorId() != null);
        return card;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
        refreshCallback = callback == null ? () -> { } : callback;
    }

    private boolean handleConnectionsPressed(EditorToolContext ctx, DungeonLayout layout, DungeonEditorHitTarget hit) {
        if (layout == null || hit == null) {
            return false;
        }
        if (hit instanceof DungeonEditorBoundaryHitTarget boundaryHit
                && isEditableDoorBoundary(boundaryHit, layout, ctx.hitService())) {
            state.selectTarget(boundaryHit.targetKey());
            applyDoorEdit(boundaryHit, false);
            return true;
        }
        if (hit instanceof DungeonEditorRoomBoundaryHitTarget roomBoundaryHit && roomBoundaryHit.exterior()) {
            if (draft == null) {
                startDraft(roomBoundaryHit);
                state.selectTarget(roomBoundaryHit.targetKey());
                return true;
            }
            finishDraftWithRoom(roomBoundaryHit);
            return true;
        }
        if (draft != null && hit instanceof DungeonEditorFloorCellHitTarget floorHit) {
            appendDraftNode(floorHit.cell());
            return true;
        }
        if (draft != null && hit instanceof DungeonEditorCorridorNodeHitTarget corridorNodeHit) {
            finishDraftWithCorridorNode(corridorNodeHit);
            return true;
        }
        if (hit instanceof DungeonEditorCorridorCornerHitTarget cornerHit) {
            selectCorridorSubTarget(cornerHit.corridor().targetKey(), null, cornerHit.route().segmentId());
            insertNode(cornerHit.corridor(), cornerHit.route().segmentId(), cornerHit.doubledPoint());
            return true;
        }
        if (hit instanceof DungeonEditorCorridorSegmentHitTarget segmentHit) {
            selectCorridorSubTarget(segmentHit.corridor().targetKey(), null, segmentHit.route().segmentId());
            insertNode(segmentHit.corridor(), segmentHit.route().segmentId(), segmentHit.doubledPoint());
            return true;
        }
        if (hit instanceof DungeonEditorCorridorNodeHitTarget nodeHit) {
            selectCorridorSubTarget(nodeHit.targetKey(), nodeHit.node().nodeId(), null);
            return true;
        }
        if (hit instanceof DungeonEditorConnectionHitTarget connectionHit) {
            state.selectTarget(connectionHit.targetKey());
            clearSubSelection();
            return true;
        }
        if (hit instanceof DungeonEditorRoomHitTarget roomHit) {
            state.selectTarget(roomHit.targetKey());
            clearSubSelection();
            return true;
        }
        return false;
    }

    private boolean handleDeletePressed(DungeonLayout layout, DungeonEditorHitTarget hit) {
        if (layout == null || hit == null) {
            return false;
        }
        if (hit instanceof DungeonEditorConnectionHitTarget connectionHit && connectionHit.editableAsLocalConnection()) {
            DungeonEditorBoundaryHitTarget boundaryHit = new DungeonEditorBoundaryHitTarget(
                    new DungeonEditorBoundaryRef(connectionHit.clusterId(), null, null),
                    connectionHit.edge(),
                    InternalBoundaryType.DOOR,
                    connectionHit.priority());
            applyDoorEdit(boundaryHit, true);
            return true;
        }
        Long corridorId = corridorId(hit);
        if (corridorId != null) {
            state.selectTarget(Corridor.targetKey(corridorId));
            Long mapId = mapState.activeMapId();
            if (mapId == null) {
                return true;
            }
            loadingService.submitReloadingWrite(
                    () -> corridorEditService.delete(mapId, corridorId),
                    mapId,
                    () -> {
                        state.clearSelection();
                        clearSubSelection();
                    },
                    throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.handleDeletePressed()", throwable));
            return true;
        }
        return false;
    }

    private void startDraft(DungeonEditorRoomBoundaryHitTarget hit) {
        long firstNodeId = -1L;
        CorridorNode startNode = roomBoundaryNode(hit, firstNodeId);
        draft = new CorridorBuildDraft(
                new ArrayList<>(List.of(startNode)),
                new ArrayList<>(),
                firstNodeId - 1,
                -1L,
                "Corridor gestartet. Freies Feld, weitere Außenwand oder Corridor-Node anklicken.");
        state.clearPreview();
        refreshStatePane();
    }

    private void appendDraftNode(Point2i cell) {
        if (draft == null || cell == null) {
            return;
        }
        Point2i doubled = new Point2i(cell.x() * 2 + 1, cell.y() * 2 + 1);
        CorridorNode node = new CorridorNode(draft.nextNodeId(), doubled.x(), doubled.y(), null, null, null);
        CorridorSegment segment = new CorridorSegment(draft.nextSegmentId(), draft.nodes().getLast().nodeId(), node.nodeId());
        draft.nodes().add(node);
        draft.segments().add(segment);
        draft = draft.advance("Node hinzugefügt. Weitere Außenwand, freies Feld oder Corridor-Node anklicken.");
        showDraftPreview();
    }

    private void finishDraftWithRoom(DungeonEditorRoomBoundaryHitTarget hit) {
        if (draft == null || hit == null) {
            return;
        }
        CorridorNode endNode = roomBoundaryNode(hit, draft.nextNodeId());
        ArrayList<CorridorNode> nodes = new ArrayList<>(draft.nodes());
        nodes.add(endNode);
        ArrayList<CorridorSegment> segments = new ArrayList<>(draft.segments());
        segments.add(new CorridorSegment(draft.nextSegmentId(), nodes.get(nodes.size() - 2).nodeId(), endNode.nodeId()));
        Corridor planned = Corridor.planned(
                mapState.activeMap().mapId(),
                mapState.activeProjectionLevel(),
                nodes,
                segments,
                DungeonCorridorGraphEditor.roomsById(mapState.activeMap()));
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        loadingService.submitReloadingTask(
                () -> corridorEditService.create(mapId, planned),
                createdId -> mapId,
                createdId -> {
                    clearDraft();
                    state.selectTarget(Corridor.targetKey(createdId));
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.finishDraftWithRoom()", throwable));
    }

    private void finishDraftWithCorridorNode(DungeonEditorCorridorNodeHitTarget hit) {
        if (draft == null || hit == null || hit.node().nodeId() == null || hit.corridor().corridorId() == null) {
            return;
        }
        ArrayList<CorridorSegment> branchSegments = new ArrayList<>(draft.segments());
        branchSegments.add(new CorridorSegment(draft.nextSegmentId(), draft.nodes().getLast().nodeId(), hit.node().nodeId()));
        Corridor updated = DungeonCorridorGraphEditor.withBranch(
                mapState.activeMap(),
                hit.corridor(),
                hit.node().nodeId(),
                draft.nodes(),
                branchSegments);
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        loadingService.submitReloadingWrite(
                () -> corridorEditService.update(mapId, updated),
                mapId,
                () -> {
                    clearDraft();
                    state.selectTarget(updated.targetKey());
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.finishDraftWithCorridorNode()", throwable));
    }

    private void insertNode(Corridor corridor, Long segmentId, Point2i doubledPoint) {
        if (corridor == null || corridor.corridorId() == null || segmentId == null || doubledPoint == null) {
            return;
        }
        Corridor updated = DungeonCorridorGraphEditor.withInsertedNode(mapState.activeMap(), corridor, segmentId, doubledPoint);
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        loadingService.submitReloadingWrite(
                () -> corridorEditService.update(mapId, updated),
                mapId,
                () -> state.selectTarget(updated.targetKey()),
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.insertNode()", throwable));
    }

    private void deleteSelectedNode() {
        Corridor corridor = selectedCorridor();
        Long mapId = mapState.activeMapId();
        if (corridor == null || mapId == null || selectedNodeId == null) {
            return;
        }
        Corridor updated = DungeonCorridorGraphEditor.withDeletedNode(mapState.activeMap(), corridor, selectedNodeId);
        loadingService.submitReloadingWrite(
                () -> corridorEditService.update(mapId, updated),
                mapId,
                () -> {
                    state.selectTarget(updated.targetKey());
                    clearSubSelection();
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.deleteSelectedNode()", throwable));
    }

    private void deleteSelectedCorridor() {
        Corridor corridor = selectedCorridor();
        Long mapId = mapState.activeMapId();
        if (corridor == null || corridor.corridorId() == null || mapId == null) {
            return;
        }
        loadingService.submitReloadingWrite(
                () -> corridorEditService.delete(mapId, corridor.corridorId()),
                mapId,
                () -> {
                    state.clearSelection();
                    clearSubSelection();
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.deleteSelectedCorridor()", throwable));
    }

    private void applyDoorEdit(DungeonEditorBoundaryHitTarget hit, boolean deleteBoundary) {
        Long mapId = mapState.activeMapId();
        Long clusterId = hit.clusterId();
        if (mapId == null || clusterId == null) {
            return;
        }
        loadingService.submitReloadingWrite(
                () -> boundaryEditService.apply(mapId, clusterId, hit.edge(), InternalBoundaryType.DOOR, deleteBoundary),
                mapId,
                null,
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.applyDoorEdit()", throwable));
    }

    private boolean isEditableDoorBoundary(
            DungeonEditorBoundaryHitTarget hit,
            DungeonLayout layout,
            DungeonEditorHitService hitService
    ) {
        if (hit == null || layout == null || hit.clusterId() == null) {
            return false;
        }
        if (hit.boundaryType() == InternalBoundaryType.DOOR) {
            return false;
        }
        List<Point2i> touchingCells = hit.edge().touchingCells().stream()
                .sorted(Point2i.POINT_ORDER)
                .toList();
        if (touchingCells.size() != 2) {
            return false;
        }
        Room leftRoom = hitService.roomAtCell(layout, touchingCells.getFirst());
        Room rightRoom = hitService.roomAtCell(layout, touchingCells.getLast());
        return leftRoom != null
                && rightRoom != null
                && leftRoom.roomId() != null
                && rightRoom.roomId() != null
                && !leftRoom.roomId().equals(rightRoom.roomId());
    }

    private CorridorNode roomBoundaryNode(DungeonEditorRoomBoundaryHitTarget hit, long nodeId) {
        Room room = hit.room();
        Point2i anchor = room == null ? new Point2i(0, 0) : room.anchorsByLevel().getOrDefault(mapState.activeProjectionLevel(), new Point2i(0, 0));
        Point2i relativeCell = hit.roomCell().subtract(anchor);
        Point2i doubled = new Point2i(hit.roomCell().x() * 2 + 1, hit.roomCell().y() * 2 + 1).add(hit.outwardStep());
        return new CorridorNode(
                nodeId,
                doubled.x(),
                doubled.y(),
                room == null ? null : room.roomId(),
                relativeCell,
                CardinalDirection.fromDirection(hit.outwardStep()));
    }

    private void showDraftPreview() {
        if (draft == null || draft.segments().isEmpty()) {
            state.clearPreview();
            refreshStatePane();
            return;
        }
        Corridor preview = Corridor.planned(
                mapState.activeMap().mapId(),
                mapState.activeProjectionLevel(),
                draft.nodes(),
                draft.segments(),
                DungeonCorridorGraphEditor.roomsById(mapState.activeMap()));
        DungeonLayout previewLayout = new DungeonLayout(
                mapState.activeMap().mapId(),
                mapState.activeMap().name(),
                mergeCorridors(preview),
                mapState.activeMap().clusters(),
                mapState.activeMap().stairs(),
                mapState.activeMap().transitions(),
                mapState.activeMap().clusterCentersById().keySet().stream()
                        .collect(Collectors.toMap(clusterId -> clusterId, clusterId -> mapState.activeMap().levelForCluster(clusterId))));
        state.showPreview(new EditorPreview.LayoutPreview(previewLayout.projectedToLevel(mapState.activeProjectionLevel())));
        refreshStatePane();
    }

    private List<Corridor> mergeCorridors(Corridor preview) {
        ArrayList<Corridor> corridors = new ArrayList<>(mapState.activeMap().corridors());
        corridors.add(preview);
        return corridors;
    }

    private void clearDraft() {
        draft = null;
        state.clearPreview();
        refreshStatePane();
    }

    private void clearSubSelection() {
        selectedNodeId = null;
        selectedSegmentId = null;
        refreshStatePane();
    }

    private void selectCorridorSubTarget(String targetKey, Long nodeId, Long segmentId) {
        state.selectTarget(targetKey);
        selectedNodeId = nodeId;
        selectedSegmentId = segmentId;
        refreshStatePane();
    }

    private Corridor selectedCorridor() {
        String targetKey = state.selectedTargetKey();
        if (!Corridor.isTargetKey(targetKey)) {
            return null;
        }
        return mapState.activeMap().findCorridor(Corridor.corridorIdFromKey(targetKey));
    }

    private static Long corridorId(DungeonEditorHitTarget hit) {
        if (hit instanceof DungeonEditorCorridorNodeHitTarget nodeHit) {
            return nodeHit.corridor().corridorId();
        }
        if (hit instanceof DungeonEditorCorridorSegmentHitTarget segmentHit) {
            return segmentHit.corridor().corridorId();
        }
        if (hit instanceof DungeonEditorCorridorCornerHitTarget cornerHit) {
            return cornerHit.corridor().corridorId();
        }
        if (hit instanceof DungeonEditorConnectionHitTarget connectionHit && Corridor.isTargetKey(connectionHit.targetKey())) {
            return Corridor.corridorIdFromKey(connectionHit.targetKey());
        }
        return null;
    }

    private String selectionText(Corridor corridor) {
        if (selectedNodeId != null) {
            return "Gewählter Node: " + selectedNodeId;
        }
        if (selectedSegmentId != null) {
            return "Gewähltes Segment: " + selectedSegmentId;
        }
        return corridor == null ? "Kein Corridor gewählt" : "Gewählter Corridor: " + corridor.corridorId();
    }

    private String connectedRoomsText(Corridor corridor) {
        if (corridor == null) {
            return "";
        }
        String rooms = corridor.connectedRoomIds().stream()
                .map(roomId -> {
                    Room room = mapState.activeMap().findRoom(roomId);
                    return room == null ? "Raum " + roomId : room.name();
                })
                .collect(Collectors.joining(", "));
        return rooms.isBlank() ? "" : "Verbunden: " + rooms;
    }

    private void refreshStatePane() {
        if (activeTool != null) {
            refreshCallback.run();
        }
    }

    private record CorridorBuildDraft(
            ArrayList<CorridorNode> nodes,
            ArrayList<CorridorSegment> segments,
            long nextNodeId,
            long nextSegmentId,
            String statusMessage
    ) {
        private CorridorBuildDraft advance(String statusMessage) {
            return new CorridorBuildDraft(nodes, segments, nextNodeId - 1, nextSegmentId - 1, statusMessage);
        }
    }
}
