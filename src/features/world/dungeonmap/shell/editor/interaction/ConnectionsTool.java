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
import features.world.dungeonmap.shell.interaction.DungeonSelection;
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
        this.state.addListener(this::refreshStatePane);
        this.mapState.addListener(this::refreshStatePane);
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
            return handleDeletePressed(ctx, ctx.activeMap(), hit);
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
        Long selectedNodeId = selectedNodeId();
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
        if (hit instanceof DungeonHitSubject.RoomBoundarySubject roomBoundaryHit) {
            if (isEditableDoorBoundary(roomBoundaryHit, layout, ctx.probe().levelZ())) {
                applySelection(ctx.selection());
                applyDoorEdit(roomBoundaryHit.clusterId(), roomBoundaryHit.edge(), false);
                return true;
            }
            if (!roomBoundaryHit.exterior()) {
                return false;
            }
            applySelection(ctx.selection());
            if (draft == null) {
                startDraft(roomBoundaryHit, layout);
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
            applySelection(ctx.selection());
            finishDraftWithCorridorNode(corridorNodeHit, layout);
            return true;
        }
        if (hit instanceof DungeonHitSubject.CorridorCornerSubject cornerHit) {
            applySelection(ctx.selection());
            insertNode(cornerHit.corridorId(), cornerHit.segmentId(), cornerHit.doubledPoint());
            return true;
        }
        if (hit instanceof DungeonHitSubject.CorridorSegmentSubject segmentHit) {
            applySelection(ctx.selection());
            insertNode(segmentHit.corridorId(), segmentHit.segmentId(), segmentHit.doubledPoint());
            return true;
        }
        if (hit instanceof DungeonHitSubject.CorridorNodeSubject nodeHit) {
            applySelection(ctx.selection());
            return true;
        }
        if (hit instanceof DungeonHitSubject.ConnectionSubject connectionHit) {
            applySelection(ctx.selection());
            return true;
        }
        if (hit instanceof DungeonHitSubject.RoomSubject roomHit) {
            applySelection(ctx.selection());
            return true;
        }
        return false;
    }

    private boolean handleDeletePressed(EditorToolContext ctx, DungeonLayout layout, DungeonHitSubject hit) {
        if (layout == null || hit == null) {
            return false;
        }
        if (hit instanceof DungeonHitSubject.ConnectionSubject connectionHit
                && connectionHit.connectionKind() == features.world.dungeonmap.model.structures.connection.ConnectionKind.LOCAL) {
            applySelection(ctx == null ? null : ctx.selection());
            applyDoorEdit(connectionHit.clusterId(), connectionHit.edge(), true);
            return true;
        }
        Long corridorId = corridorId(hit);
        if (corridorId != null) {
            applySelection(ctx == null ? null : ctx.selection());
            Long mapId = mapState.activeMapId();
            if (mapId == null) {
                return true;
            }
            loadingService.submitReloadingWrite(
                () -> corridorEditService.delete(mapId, corridorId),
                mapId,
                state::clearSelection,
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
                    selectCorridor(createdId);
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
                    selectCorridor(updated.corridorId());
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
                () -> selectCorridor(updated.corridorId()),
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.insertNode()", throwable));
    }

    private void deleteSelectedNode() {
        Corridor corridor = selectedCorridor();
        Long mapId = mapState.activeMapId();
        Long selectedNodeId = selectedNodeId();
        if (corridor == null || mapId == null || selectedNodeId == null) {
            return;
        }
        Corridor updated = DungeonCorridorGraphEditor.withDeletedNode(mapState.activeMap(), corridor, selectedNodeId);
        loadingService.submitReloadingWrite(
                () -> corridorEditService.update(mapId, updated),
                mapId,
                () -> selectCorridor(updated.corridorId()),
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
                state::clearSelection,
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.deleteSelectedCorridor()", throwable));
    }

    private void applyDoorEdit(Long clusterId, features.world.dungeonmap.model.geometry.VertexEdge edge, boolean deleteBoundary) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || clusterId == null || edge == null) {
            return;
        }
        loadingService.submitReloadingWrite(
                () -> boundaryEditService.apply(mapId, clusterId, edge, InternalBoundaryType.DOOR, deleteBoundary),
                mapId,
                null,
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.applyDoorEdit()", throwable));
    }

    private boolean isEditableDoorBoundary(
            DungeonHitSubject.RoomBoundarySubject hit,
            DungeonLayout layout,
            int levelZ
    ) {
        if (hit == null || layout == null || hit.clusterId() == null) {
            return false;
        }
        if (hit.exterior()) {
            return false;
        }
        var cluster = layout.findCluster(hit.clusterId());
        var projectedCluster = cluster == null ? null : cluster.projectedToLevel(levelZ);
        if (projectedCluster == null) {
            return false;
        }
        Room sourceRoom = projectedCluster.roomAt(hit.roomCell());
        Point2i oppositeCell = hit.roomCell().add(hit.outwardStep());
        Room oppositeRoom = projectedCluster.roomAt(oppositeCell);
        if (sourceRoom == null || oppositeRoom == null) {
            return false;
        }
        return sourceRoom.roomId() != null
                && oppositeRoom.roomId() != null
                && !sourceRoom.roomId().equals(oppositeRoom.roomId());
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

    private Corridor selectedCorridor() {
        Long corridorId = selectedCorridorId();
        if (corridorId == null) {
            return null;
        }
        return mapState.activeMap().findCorridor(corridorId);
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

    private void applySelection(DungeonSelection selection) {
        if (selection != null) {
            state.applySelection(selection);
        }
    }

    private void selectCorridor(Long corridorId) {
        if (corridorId == null) {
            state.clearSelection();
            return;
        }
        state.selectSubject(new DungeonHitSubject.CorridorSubject(corridorId, mapState.activeProjectionLevel()));
    }

    private DungeonHitSubject selectedSubject() {
        return state.selectedSubject();
    }

    private Long selectedCorridorId() {
        return corridorId(selectedSubject());
    }

    private Long selectedNodeId() {
        DungeonHitSubject subject = selectedSubject();
        return subject instanceof DungeonHitSubject.CorridorNodeSubject corridorNodeSubject
                ? corridorNodeSubject.nodeId()
                : null;
    }

    private Long selectedSegmentId() {
        DungeonHitSubject subject = selectedSubject();
        return switch (subject) {
            case DungeonHitSubject.CorridorCornerSubject corridorCornerSubject -> corridorCornerSubject.segmentId();
            case DungeonHitSubject.CorridorSegmentSubject corridorSegmentSubject -> corridorSegmentSubject.segmentId();
            default -> null;
        };
    }

    private String selectionText(Corridor corridor) {
        Long selectedNodeId = selectedNodeId();
        if (selectedNodeId != null) {
            return "Gewählter Node: " + selectedNodeId;
        }
        Long selectedSegmentId = selectedSegmentId();
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
