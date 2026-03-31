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
import features.world.dungeonmap.shell.interaction.DungeonHitSubject;
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
        DungeonHitSubject hit = primarySubject(ctx);
        if (sessionState.selectedTool() == DungeonEditorTool.CONNECTIONS_DELETE) {
            return handleDeletePressed(ctx.activeMap(), hit);
        }
        return handleConnectionsPressed(ctx, ctx.activeMap(), hit);
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

    private boolean handleConnectionsPressed(EditorToolContext ctx, DungeonLayout layout, DungeonHitSubject hit) {
        if (layout == null || hit == null) {
            return false;
        }
        if (hit instanceof DungeonHitSubject.ClusterBoundarySubject boundaryHit
                && isEditableDoorBoundary(boundaryHit, layout, ctx.probe().levelZ())) {
            state.selectTarget(boundaryHit.targetKey());
            applyDoorEdit(boundaryHit, false);
            return true;
        }
        if (hit instanceof DungeonHitSubject.RoomBoundarySubject roomBoundaryHit && roomBoundaryHit.exterior()) {
            if (draft == null) {
                startDraft(roomBoundaryHit, layout);
                state.selectTarget(roomBoundaryHit.targetKey());
                return true;
            }
            finishDraftWithRoom(roomBoundaryHit, layout);
            return true;
        }
        if (draft != null && hit instanceof DungeonHitSubject.FloorCellSubject floorHit) {
            appendDraftNode(floorHit.cell());
            return true;
        }
        if (draft != null && hit instanceof DungeonHitSubject.CorridorNodeSubject corridorNodeHit) {
            finishDraftWithCorridorNode(corridorNodeHit, layout);
            return true;
        }
        if (hit instanceof DungeonHitSubject.CorridorCornerSubject cornerHit) {
            selectCorridorSubTarget(cornerHit.targetKey(), null, cornerHit.segmentId());
            insertNode(cornerHit.corridorId(), cornerHit.segmentId(), cornerHit.doubledPoint());
            return true;
        }
        if (hit instanceof DungeonHitSubject.CorridorSegmentSubject segmentHit) {
            selectCorridorSubTarget(segmentHit.targetKey(), null, segmentHit.segmentId());
            insertNode(segmentHit.corridorId(), segmentHit.segmentId(), segmentHit.doubledPoint());
            return true;
        }
        if (hit instanceof DungeonHitSubject.CorridorNodeSubject nodeHit) {
            selectCorridorSubTarget(nodeHit.targetKey(), nodeHit.nodeId(), null);
            return true;
        }
        if (hit instanceof DungeonHitSubject.ConnectionSubject connectionHit) {
            state.selectTarget(connectionHit.targetKey());
            clearSubSelection();
            return true;
        }
        if (hit instanceof DungeonHitSubject.RoomSubject roomHit) {
            state.selectTarget(roomHit.targetKey());
            clearSubSelection();
            return true;
        }
        return false;
    }

    private boolean handleDeletePressed(DungeonLayout layout, DungeonHitSubject hit) {
        if (layout == null || hit == null) {
            return false;
        }
        if (hit instanceof DungeonHitSubject.ConnectionSubject connectionHit
                && connectionHit.connectionKind() == features.world.dungeonmap.model.structures.connection.ConnectionKind.LOCAL) {
            List<Point2i> touchingCells = connectionHit.edge().touchingCells().stream()
                    .sorted(Point2i.POINT_ORDER)
                    .toList();
            if (touchingCells.isEmpty()) {
                return false;
            }
            Point2i baseCell = touchingCells.getFirst();
            DungeonHitSubject.ClusterBoundarySubject boundaryHit = new DungeonHitSubject.ClusterBoundarySubject(
                    connectionHit.clusterId(),
                    connectionHit.edge(),
                    InternalBoundaryType.DOOR,
                    baseCell,
                    connectionHit.edge().directionFrom(baseCell));
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

    private void startDraft(DungeonHitSubject.RoomBoundarySubject hit, DungeonLayout layout) {
        long firstNodeId = -1L;
        Room room = layout.findRoom(hit.roomId());
        if (room == null) {
            return;
        }
        CorridorNode startNode = roomBoundaryNode(room, hit, firstNodeId);
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

    private void finishDraftWithRoom(DungeonHitSubject.RoomBoundarySubject hit, DungeonLayout layout) {
        if (draft == null || hit == null) {
            return;
        }
        Room room = layout.findRoom(hit.roomId());
        if (room == null) {
            return;
        }
        CorridorNode endNode = roomBoundaryNode(room, hit, draft.nextNodeId());
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

    private void finishDraftWithCorridorNode(DungeonHitSubject.CorridorNodeSubject hit, DungeonLayout layout) {
        if (draft == null || hit == null || hit.nodeId() == null || hit.corridorId() == null) {
            return;
        }
        Corridor corridor = layout.findCorridor(hit.corridorId());
        if (corridor == null) {
            return;
        }
        ArrayList<CorridorSegment> branchSegments = new ArrayList<>(draft.segments());
        branchSegments.add(new CorridorSegment(draft.nextSegmentId(), draft.nodes().getLast().nodeId(), hit.nodeId()));
        Corridor updated = DungeonCorridorGraphEditor.withBranch(
                mapState.activeMap(),
                corridor,
                hit.nodeId(),
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

    private void insertNode(Long corridorId, Long segmentId, Point2i doubledPoint) {
        Corridor corridor = mapState.activeMap().findCorridor(corridorId);
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

    private void applyDoorEdit(DungeonHitSubject.ClusterBoundarySubject hit, boolean deleteBoundary) {
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
            DungeonHitSubject.ClusterBoundarySubject hit,
            DungeonLayout layout,
            int levelZ
    ) {
        if (hit == null || layout == null || hit.clusterId() == null) {
            return false;
        }
        if (hit.boundaryType() == InternalBoundaryType.DOOR) {
            return false;
        }
        var cluster = layout.findCluster(hit.clusterId());
        var projectedCluster = cluster == null ? null : cluster.projectedToLevel(levelZ);
        if (projectedCluster == null) {
            return false;
        }
        List<Point2i> touchingCells = hit.edge().touchingCells().stream()
                .sorted(Point2i.POINT_ORDER)
                .toList();
        if (touchingCells.size() != 2) {
            return false;
        }
        Room leftRoom = projectedCluster.roomAt(touchingCells.getFirst());
        Room rightRoom = projectedCluster.roomAt(touchingCells.getLast());
        return leftRoom != null
                && rightRoom != null
                && leftRoom.roomId() != null
                && rightRoom.roomId() != null
                && !leftRoom.roomId().equals(rightRoom.roomId());
    }

    private CorridorNode roomBoundaryNode(Room room, DungeonHitSubject.RoomBoundarySubject hit, long nodeId) {
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

    private static Long corridorId(DungeonHitSubject hit) {
        return switch (hit) {
            case DungeonHitSubject.CorridorSubject corridorSubject -> corridorSubject.corridorId();
            case DungeonHitSubject.CorridorNodeSubject corridorNodeSubject -> corridorNodeSubject.corridorId();
            case DungeonHitSubject.CorridorCornerSubject corridorCornerSubject -> corridorCornerSubject.corridorId();
            case DungeonHitSubject.CorridorSegmentSubject corridorSegmentSubject -> corridorSegmentSubject.corridorId();
            case DungeonHitSubject.ConnectionSubject connectionSubject ->
                    connectionSubject.connectionKind() == features.world.dungeonmap.model.structures.connection.ConnectionKind.CORRIDOR
                            ? connectionSubject.corridorId()
                            : null;
            default -> null;
        };
    }

    private static DungeonHitSubject primarySubject(EditorToolContext ctx) {
        return ctx == null || ctx.selection() == null || ctx.selection().primary() == null
                ? null
                : ctx.selection().primary().descriptor().subject();
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
