package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.corridor.DungeonCorridorApplicationService;
import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNode;
import features.world.dungeonmap.model.structures.corridor.CorridorSegment;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.shell.editor.EditorCards;
import features.world.dungeonmap.shell.interaction.DungeonHitSubject;
import features.world.dungeonmap.state.DungeonEditorTool;
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
    private final DungeonRoomTopologyService roomTopologyService;
    private final DungeonCorridorApplicationService corridorApplicationService;
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
            DungeonRoomTopologyService roomTopologyService,
            DungeonCorridorApplicationService corridorApplicationService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.roomTopologyService = Objects.requireNonNull(roomTopologyService, "roomTopologyService");
        this.corridorApplicationService = Objects.requireNonNull(corridorApplicationService, "corridorApplicationService");
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
        DungeonHitSubject hit = ctx == null ? null : ctx.resolvedSubject();
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
    public EditorHitResolution resolveHit(EditorToolContext ctx, EditorToolPhase phase) {
        DungeonHitSubject subject = resolvedSubject(
                ctx == null ? null : ctx.snapshot(),
                ctx == null ? null : ctx.activeMap(),
                ctx == null || ctx.probe() == null ? mapState.activeProjectionLevel() : ctx.probe().levelZ());
        if (subject == null
                && draft != null
                && sessionState.selectedTool() == DungeonEditorTool.CONNECTIONS
                && ctx != null
                && ctx.probe() != null) {
            subject = new DungeonHitSubject.FloorCellSubject(ctx.probe().gridCell(), ctx.probe().levelZ());
        }
        if (subject == null) {
            return EditorHitResolution.none();
        }
        if (subject instanceof DungeonHitSubject.RoomBoundarySubject
                || subject instanceof DungeonHitSubject.ConnectionSubject
                || subject instanceof DungeonHitSubject.CorridorNodeSubject
                || subject instanceof DungeonHitSubject.CorridorCornerSubject
                || subject instanceof DungeonHitSubject.CorridorSegmentSubject
                || subject instanceof DungeonHitSubject.FloorCellSubject) {
            return EditorHitResolution.part(subject);
        }
        if (subject instanceof DungeonHitSubject.RoomSubject
                || subject instanceof DungeonHitSubject.CorridorSubject) {
            return EditorHitResolution.owner(subject);
        }
        return EditorHitResolution.subjectOnly(subject);
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
                applySelection(ctx == null ? null : ctx.resolvedRef());
                applyDoorEdit(
                        roomBoundaryHit.clusterId(),
                        roomBoundaryHit.boundarySegment2x(),
                        false,
                        ctx == null ? null : ctx.resolvedRef());
                return true;
            }
            if (!roomBoundaryHit.exterior()) {
                return false;
            }
            applySelection(ctx == null ? null : ctx.resolvedRef());
            if (draft == null) {
                startDraft(roomBoundaryHit, layout);
                return true;
            }
            finishDraftWithRoom(roomBoundaryHit, layout);
            return true;
        }
        if (draft != null && hit instanceof DungeonHitSubject.FloorCellSubject floorHit) {
            GridPoint2x point2x = ctx == null || ctx.probe() == null
                    ? GridPoint2x.cell(floorHit.cell())
                    : ctx.probe().probePoint2x();
            appendDraftNode(point2x);
            return true;
        }
        if (draft != null && hit instanceof DungeonHitSubject.CorridorNodeSubject corridorNodeHit) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            finishDraftWithCorridorNode(corridorNodeHit, layout);
            return true;
        }
        if (hit instanceof DungeonHitSubject.CorridorCornerSubject cornerHit) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            insertNode(cornerHit.corridorId(), cornerHit.segmentId(), cornerHit.point2x());
            return true;
        }
        if (hit instanceof DungeonHitSubject.CorridorSegmentSubject segmentHit) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            insertNode(segmentHit.corridorId(), segmentHit.segmentId(), segmentHit.point2x());
            return true;
        }
        if (hit instanceof DungeonHitSubject.CorridorNodeSubject nodeHit) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            return true;
        }
        if (hit instanceof DungeonHitSubject.ConnectionSubject connectionHit) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            return true;
        }
        if (hit instanceof DungeonHitSubject.RoomSubject roomHit) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
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
            applySelection(ctx == null ? null : ctx.resolvedRef());
            applyDoorEdit(
                    connectionHit.clusterId(),
                    connectionHit.boundarySegment2x(),
                    true,
                    clusterOwnerRef(connectionHit.clusterId()));
            return true;
        }
        Long corridorId = corridorId(hit);
        if (corridorId != null) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            Long mapId = mapState.activeMapId();
            if (mapId == null) {
                return true;
            }
            loadingService.submitMutation(
                () -> {
                    corridorApplicationService.delete(mapId, corridorId);
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.clearSelection(),
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

    private void appendDraftNode(GridPoint2x point2x) {
        if (draft == null || point2x == null) {
            return;
        }
        CorridorNode node = new CorridorNode(draft.nextNodeId(), point2x, null, null, null);
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
                mapState.activeMap().rooms());
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> corridorApplicationService.create(mapId, planned),
                createdId -> mapId,
                createdId -> {
                    clearDraft();
                    state.selectRef(corridorOwnerRef(createdId));
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
        Corridor updated = corridor.branchedFrom(mapState.activeMap(), hit.nodeId(), draft.nodes(), branchSegments);
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    corridorApplicationService.update(mapId, updated);
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                    clearDraft();
                    state.selectRef(corridorOwnerRef(updated.corridorId()));
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.finishDraftWithCorridorNode()", throwable));
    }

    private void insertNode(Long corridorId, Long segmentId, GridPoint2x point2x) {
        Corridor corridor = mapState.activeMap().findCorridor(corridorId);
        if (corridor == null || corridor.corridorId() == null || segmentId == null || point2x == null) {
            return;
        }
        Corridor updated = corridor.insertedNode(mapState.activeMap(), segmentId, point2x);
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    corridorApplicationService.update(mapId, updated);
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.selectRef(corridorOwnerRef(updated.corridorId())),
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.insertNode()", throwable));
    }

    private void deleteSelectedNode() {
        Corridor corridor = selectedCorridor();
        Long mapId = mapState.activeMapId();
        Long selectedNodeId = selectedNodeId();
        if (corridor == null || mapId == null || selectedNodeId == null) {
            return;
        }
        Corridor updated = corridor.deletedNode(mapState.activeMap(), selectedNodeId);
        loadingService.submitMutation(
                () -> {
                    corridorApplicationService.update(mapId, updated);
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.selectRef(corridorOwnerRef(updated.corridorId())),
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.deleteSelectedNode()", throwable));
    }

    private void deleteSelectedCorridor() {
        Corridor corridor = selectedCorridor();
        Long mapId = mapState.activeMapId();
        if (corridor == null || corridor.corridorId() == null || mapId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    corridorApplicationService.delete(mapId, corridor.corridorId());
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.clearSelection(),
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.deleteSelectedCorridor()", throwable));
    }

    private void applyDoorEdit(
            Long clusterId,
            features.world.dungeonmap.model.geometry.GridSegment2x segment2x,
            boolean deleteBoundary,
            DungeonSelectionRef followUpRef
    ) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || clusterId == null || segment2x == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    if (deleteBoundary) {
                        roomTopologyService.deleteDoor(
                                mapId,
                                clusterId,
                                mapState.activeProjectionLevel(),
                                List.of(segment2x));
                    } else {
                        roomTopologyService.createDoor(
                                mapId,
                                clusterId,
                                mapState.activeProjectionLevel(),
                                List.of(segment2x));
                    }
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.selectRef(followUpRef),
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
        return projectedCluster != null && projectedCluster.canCreateDoor(hit.boundarySegment2x());
    }

    private CorridorNode roomBoundaryNode(Room room, DungeonHitSubject.RoomBoundarySubject hit, long nodeId) {
        CellCoord anchor = room == null || room.structure().floorAtLevel(mapState.activeProjectionLevel()) == null
                ? new CellCoord(0, 0)
                : room.structure().floorAtLevel(mapState.activeProjectionLevel()).anchorCellCoord();
        if (anchor == null) {
            anchor = new CellCoord(0, 0);
        }
        CellCoord relativeCell = hit.roomCell().subtract(anchor);
        GridPoint2x point2x = GridPoint2x.edgeCenter(hit.roomCell(), hit.outwardDirection());
        return new CorridorNode(
                nodeId,
                point2x,
                room == null ? null : room.roomId(),
                relativeCell,
                hit.outwardDirection());
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
                mapState.activeMap().rooms());
        DungeonLayout previewLayout = mapState.activeMap().withAddedCorridor(preview);
        state.showPreview(new EditorPreview.LayoutPreview(previewLayout.projectedToLevel(mapState.activeProjectionLevel())));
        refreshStatePane();
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

    private DungeonHitSubject resolvedSubject(
            features.world.dungeonmap.shell.interaction.DungeonHitSnapshot snapshot,
            DungeonLayout layout,
            int levelZ
    ) {
        if (snapshot == null) {
            return null;
        }
        List<DungeonHitSubject> subjects = snapshot.orderedSubjects();
        if (subjects.isEmpty()) {
            return null;
        }
        if (sessionState.selectedTool() == DungeonEditorTool.CONNECTIONS_DELETE) {
            return resolveDeleteSubject(subjects);
        }
        return resolveCreateSubject(subjects, layout, levelZ);
    }

    private DungeonHitSubject resolveCreateSubject(List<DungeonHitSubject> subjects, DungeonLayout layout, int levelZ) {
        if (draft == null) {
            DungeonHitSubject editableDoor = firstMatching(subjects, subject -> subject instanceof DungeonHitSubject.RoomBoundarySubject roomBoundary
                    && isEditableDoorBoundary(roomBoundary, layout, levelZ));
            if (editableDoor != null) {
                return editableDoor;
            }
            DungeonHitSubject exteriorBoundary = firstMatching(subjects, subject -> subject instanceof DungeonHitSubject.RoomBoundarySubject roomBoundary
                    && roomBoundary.exterior());
            if (exteriorBoundary != null) {
                return exteriorBoundary;
            }
            DungeonHitSubject graphHandle = firstMatching(subjects, subject ->
                    subject instanceof DungeonHitSubject.CorridorNodeSubject
                            || subject instanceof DungeonHitSubject.CorridorCornerSubject
                            || subject instanceof DungeonHitSubject.CorridorSegmentSubject);
            if (graphHandle != null) {
                return graphHandle;
            }
            return firstMatching(subjects, subject ->
                    subject instanceof DungeonHitSubject.ConnectionSubject
                            || subject instanceof DungeonHitSubject.RoomSubject
                            || subject instanceof DungeonHitSubject.CorridorSubject);
        }
        DungeonHitSubject finishBoundary = firstMatching(subjects, subject -> subject instanceof DungeonHitSubject.RoomBoundarySubject roomBoundary
                && roomBoundary.exterior());
        if (finishBoundary != null) {
            return finishBoundary;
        }
        DungeonHitSubject branchNode = firstMatching(subjects, subject -> subject instanceof DungeonHitSubject.CorridorNodeSubject);
        if (branchNode != null) {
            return branchNode;
        }
        DungeonHitSubject floorCell = firstMatching(subjects, subject -> subject instanceof DungeonHitSubject.FloorCellSubject);
        if (floorCell != null) {
            return floorCell;
        }
        return firstMatching(subjects, subject ->
                subject instanceof DungeonHitSubject.ConnectionSubject
                        || subject instanceof DungeonHitSubject.RoomSubject
                        || subject instanceof DungeonHitSubject.CorridorSubject);
    }

    private static DungeonHitSubject resolveDeleteSubject(List<DungeonHitSubject> subjects) {
        DungeonHitSubject localConnection = firstMatching(subjects, subject -> subject instanceof DungeonHitSubject.ConnectionSubject connection
                && connection.connectionKind() == features.world.dungeonmap.model.structures.connection.ConnectionKind.LOCAL);
        if (localConnection != null) {
            return localConnection;
        }
        return firstMatching(subjects, subject -> corridorId(subject) != null);
    }

    private static DungeonHitSubject firstMatching(List<DungeonHitSubject> subjects, java.util.function.Predicate<DungeonHitSubject> predicate) {
        if (subjects == null || predicate == null) {
            return null;
        }
        for (DungeonHitSubject subject : subjects) {
            if (subject != null && predicate.test(subject)) {
                return subject;
            }
        }
        return null;
    }

    private void applySelection(DungeonSelectionRef resolvedRef) {
        if (resolvedRef != null) {
            state.selectRef(resolvedRef);
        }
    }

    private Long selectedCorridorId() {
        Corridor corridor = mapState.activeMap().corridor(state.selectedRef());
        return corridor == null ? null : corridor.corridorId();
    }

    private Long selectedNodeId() {
        return state.selectedRef() instanceof DungeonSelectionRef.CorridorNodeRef corridorNodeRef
                ? corridorNodeRef.nodeId()
                : null;
    }

    private Long selectedSegmentId() {
        return state.selectedRef() instanceof DungeonSelectionRef.CorridorSegmentRef corridorSegmentRef
                ? corridorSegmentRef.segmentId()
                : null;
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

    private static DungeonSelectionRef corridorOwnerRef(Long corridorId) {
        if (corridorId == null) {
            return null;
        }
        return new DungeonSelectionRef.CorridorRef(corridorId);
    }

    private static DungeonSelectionRef clusterOwnerRef(Long clusterId) {
        if (clusterId == null) {
            return null;
        }
        return new DungeonSelectionRef.ClusterRef(clusterId);
    }
}
