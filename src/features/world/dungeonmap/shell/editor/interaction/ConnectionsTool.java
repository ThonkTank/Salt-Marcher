package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.corridor.DungeonCorridorApplicationService;
import features.world.dungeonmap.application.room.DungeonRoomApplicationService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNode;
import features.world.dungeonmap.model.structures.corridor.CorridorSegment;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.shell.editor.EditorCards;
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
    private final DungeonRoomApplicationService roomApplicationService;
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
            DungeonRoomApplicationService roomApplicationService,
            DungeonCorridorApplicationService corridorApplicationService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.roomApplicationService = Objects.requireNonNull(roomApplicationService, "roomApplicationService");
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
        DungeonSelectionRef hit = ctx == null ? null : ctx.hitRef();
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
        DungeonSelectionRef hitRef = resolvedHitRef(
                ctx == null ? null : ctx.snapshot(),
                ctx == null ? null : ctx.activeMap(),
                ctx == null || ctx.probe() == null ? mapState.activeProjectionLevel() : ctx.probe().levelZ());
        if (hitRef == null
                && draft != null
                && sessionState.selectedTool() == DungeonEditorTool.CONNECTIONS
                && ctx != null
                && ctx.probe() != null) {
            hitRef = new DungeonSelectionRef.FloorCellRef(
                    features.world.dungeonmap.model.geometry.CubePoint.at(ctx.probe().gridCell(), ctx.probe().levelZ()));
        }
        if (hitRef == null) {
            return EditorHitResolution.none();
        }
        if (hitRef instanceof DungeonSelectionRef.RoomBoundaryRef
                || hitRef instanceof DungeonSelectionRef.ConnectionRef
                || hitRef instanceof DungeonSelectionRef.CorridorNodeRef
                || hitRef instanceof DungeonSelectionRef.CorridorCornerRef
                || hitRef instanceof DungeonSelectionRef.CorridorSegmentRef
                || hitRef instanceof DungeonSelectionRef.FloorCellRef) {
            return EditorHitResolution.part(hitRef);
        }
        if (hitRef instanceof DungeonSelectionRef.RoomRef
                || hitRef instanceof DungeonSelectionRef.CorridorRef) {
            return EditorHitResolution.owner(hitRef);
        }
        return EditorHitResolution.ref(hitRef);
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

    private boolean handleConnectionsPressed(EditorToolContext ctx, DungeonLayout layout, DungeonSelectionRef hit) {
        if (layout == null || hit == null) {
            return false;
        }
        int levelZ = ctx == null || ctx.probe() == null ? mapState.activeProjectionLevel() : ctx.probe().levelZ();
        if (hit instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundaryHit) {
            DungeonLayout.RoomBoundaryDescription boundary = layout.describeRoomBoundary(roomBoundaryHit, levelZ);
            if (boundary == null) {
                return false;
            }
            if (isEditableDoorBoundary(roomBoundaryHit, boundary, layout, levelZ)) {
                applySelection(ctx == null ? null : ctx.resolvedRef());
                applyDoorEdit(
                        boundary.clusterId(),
                        roomBoundaryHit.boundarySegment2x(),
                        false,
                        ctx == null ? null : ctx.resolvedRef());
                return true;
            }
            if (!boundary.exterior()) {
                return false;
            }
            applySelection(ctx == null ? null : ctx.resolvedRef());
            if (draft == null) {
                startDraft(roomBoundaryHit, boundary);
                return true;
            }
            finishDraftWithRoom(roomBoundaryHit, boundary);
            return true;
        }
        if (draft != null && hit instanceof DungeonSelectionRef.FloorCellRef floorHit) {
            GridPoint2x point2x = ctx == null || ctx.probe() == null
                    ? GridPoint2x.cell(floorHit.cell().projectedCell())
                    : ctx.probe().probePoint2x();
            appendDraftNode(point2x);
            return true;
        }
        if (draft != null && hit instanceof DungeonSelectionRef.CorridorNodeRef corridorNodeHit) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            finishDraftWithCorridorNode(corridorNodeHit);
            return true;
        }
        if (hit instanceof DungeonSelectionRef.CorridorCornerRef cornerHit) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            insertNode(cornerHit.corridorId(), cornerHit.segmentId(), cornerHit.point2x());
            return true;
        }
        if (hit instanceof DungeonSelectionRef.CorridorSegmentRef segmentHit) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            insertNode(segmentHit.corridorId(), segmentHit.segmentId(), segmentHit.point2x());
            return true;
        }
        if (hit instanceof DungeonSelectionRef.CorridorNodeRef) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            return true;
        }
        if (hit instanceof DungeonSelectionRef.ConnectionRef) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            return true;
        }
        if (hit instanceof DungeonSelectionRef.RoomRef) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            return true;
        }
        return false;
    }

    private boolean handleDeletePressed(EditorToolContext ctx, DungeonLayout layout, DungeonSelectionRef hit) {
        if (layout == null || hit == null) {
            return false;
        }
        if (hit instanceof DungeonSelectionRef.ConnectionRef connectionHit
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

    private void startDraft(
            DungeonSelectionRef.RoomBoundaryRef hit,
            DungeonLayout.RoomBoundaryDescription boundary
    ) {
        long firstNodeId = -1L;
        CorridorNode startNode = roomBoundaryNode(hit, boundary, firstNodeId);
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

    private void finishDraftWithRoom(
            DungeonSelectionRef.RoomBoundaryRef hit,
            DungeonLayout.RoomBoundaryDescription boundary
    ) {
        if (draft == null || hit == null || boundary == null) {
            return;
        }
        CorridorNode endNode = roomBoundaryNode(hit, boundary, draft.nextNodeId());
        ArrayList<CorridorNode> nodes = new ArrayList<>(draft.nodes());
        nodes.add(endNode);
        ArrayList<CorridorSegment> segments = new ArrayList<>(draft.segments());
        segments.add(new CorridorSegment(draft.nextSegmentId(), nodes.get(nodes.size() - 2).nodeId(), endNode.nodeId()));
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> corridorApplicationService.create(mapId, mapState.activeProjectionLevel(), nodes, segments),
                createdId -> mapId,
                createdId -> {
                    clearDraft();
                    state.selectRef(corridorOwnerRef(createdId));
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.finishDraftWithRoom()", throwable));
    }

    private void finishDraftWithCorridorNode(DungeonSelectionRef.CorridorNodeRef hit) {
        if (draft == null || hit == null || hit.nodeId() == null || hit.corridorId() == null) {
            return;
        }
        ArrayList<CorridorSegment> branchSegments = new ArrayList<>(draft.segments());
        branchSegments.add(new CorridorSegment(draft.nextSegmentId(), draft.nodes().getLast().nodeId(), hit.nodeId()));
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    corridorApplicationService.branch(mapId, hit.corridorId(), hit.nodeId(), draft.nodes(), branchSegments);
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                    clearDraft();
                    state.selectRef(corridorOwnerRef(hit.corridorId()));
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.finishDraftWithCorridorNode()", throwable));
    }

    private void insertNode(Long corridorId, Long segmentId, GridPoint2x point2x) {
        Corridor corridor = mapState.activeMap().findCorridor(corridorId);
        if (corridor == null || corridor.corridorId() == null || segmentId == null || point2x == null) {
            return;
        }
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    corridorApplicationService.insertNode(mapId, corridor.corridorId(), segmentId, point2x);
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.selectRef(corridorOwnerRef(corridor.corridorId())),
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.insertNode()", throwable));
    }

    private void deleteSelectedNode() {
        Corridor corridor = selectedCorridor();
        Long mapId = mapState.activeMapId();
        Long selectedNodeId = selectedNodeId();
        if (corridor == null || mapId == null || selectedNodeId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    corridorApplicationService.deleteNode(mapId, corridor.corridorId(), selectedNodeId);
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.selectRef(corridorOwnerRef(corridor.corridorId())),
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
                        roomApplicationService.deleteDoor(
                                mapId,
                                clusterId,
                                mapState.activeProjectionLevel(),
                                List.of(segment2x));
                    } else {
                        roomApplicationService.createDoor(
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
            DungeonSelectionRef.RoomBoundaryRef hit,
            DungeonLayout.RoomBoundaryDescription boundary,
            DungeonLayout layout,
            int levelZ
    ) {
        if (hit == null || boundary == null || layout == null || boundary.clusterId() == null) {
            return false;
        }
        if (boundary.exterior()) {
            return false;
        }
        RoomCluster cluster = layout.findCluster(boundary.clusterId());
        RoomCluster projectedCluster = cluster == null ? null : cluster.projectedToLevel(levelZ);
        return projectedCluster != null && projectedCluster.canCreateDoor(hit.boundarySegment2x());
    }

    private static CorridorNode roomBoundaryNode(
            DungeonSelectionRef.RoomBoundaryRef hit,
            DungeonLayout.RoomBoundaryDescription boundary,
            long nodeId
    ) {
        GridPoint2x point2x = GridPoint2x.edgeCenter(boundary.roomCell(), boundary.outwardDirection());
        return new CorridorNode(
                nodeId,
                point2x,
                hit.roomId(),
                boundary.roomCell(),
                boundary.outwardDirection());
    }

    private void showDraftPreview() {
        if (draft == null || draft.segments().isEmpty()) {
            state.clearPreview();
            refreshStatePane();
            return;
        }
        Corridor preview = mapState.activeMap().planCorridor(mapState.activeProjectionLevel(), draft.nodes(), draft.segments());
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

    private static Long corridorId(DungeonSelectionRef ref) {
        return switch (ref) {
            case DungeonSelectionRef.CorridorRef corridorRef -> corridorRef.corridorId();
            case DungeonSelectionRef.CorridorNodeRef corridorNodeRef -> corridorNodeRef.corridorId();
            case DungeonSelectionRef.CorridorCornerRef corridorCornerRef -> corridorCornerRef.corridorId();
            case DungeonSelectionRef.CorridorSegmentRef corridorSegmentRef -> corridorSegmentRef.corridorId();
            case DungeonSelectionRef.ConnectionRef connectionRef ->
                    connectionRef.connectionKind() == features.world.dungeonmap.model.structures.connection.ConnectionKind.CORRIDOR
                            ? connectionRef.corridorId()
                            : null;
            default -> null;
        };
    }

    private DungeonSelectionRef resolvedHitRef(
            features.world.dungeonmap.shell.interaction.DungeonHitSnapshot snapshot,
            DungeonLayout layout,
            int levelZ
    ) {
        if (snapshot == null) {
            return null;
        }
        List<DungeonSelectionRef> refs = snapshot.orderedRefs();
        if (refs.isEmpty()) {
            return null;
        }
        if (sessionState.selectedTool() == DungeonEditorTool.CONNECTIONS_DELETE) {
            return resolveDeleteRef(refs);
        }
        return resolveCreateRef(refs, layout, levelZ);
    }

    private DungeonSelectionRef resolveCreateRef(List<DungeonSelectionRef> refs, DungeonLayout layout, int levelZ) {
        if (draft == null) {
            DungeonSelectionRef editableDoor = firstMatching(refs, ref ->
                    ref instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary
                            && isEditableDoorBoundary(
                            roomBoundary,
                            layout == null ? null : layout.describeRoomBoundary(roomBoundary, levelZ),
                            layout,
                            levelZ));
            if (editableDoor != null) {
                return editableDoor;
            }
            DungeonSelectionRef exteriorBoundary = firstMatching(refs, ref ->
                    ref instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary
                            && isExteriorBoundary(layout, roomBoundary, levelZ));
            if (exteriorBoundary != null) {
                return exteriorBoundary;
            }
            DungeonSelectionRef graphHandle = firstMatching(refs, ref ->
                    ref instanceof DungeonSelectionRef.CorridorNodeRef
                            || ref instanceof DungeonSelectionRef.CorridorCornerRef
                            || ref instanceof DungeonSelectionRef.CorridorSegmentRef);
            if (graphHandle != null) {
                return graphHandle;
            }
            return firstMatching(refs, ref ->
                    ref instanceof DungeonSelectionRef.ConnectionRef
                            || ref instanceof DungeonSelectionRef.RoomRef
                            || ref instanceof DungeonSelectionRef.CorridorRef);
        }
        DungeonSelectionRef finishBoundary = firstMatching(refs, ref ->
                ref instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary
                        && isExteriorBoundary(layout, roomBoundary, levelZ));
        if (finishBoundary != null) {
            return finishBoundary;
        }
        DungeonSelectionRef branchNode = firstMatching(refs, ref -> ref instanceof DungeonSelectionRef.CorridorNodeRef);
        if (branchNode != null) {
            return branchNode;
        }
        DungeonSelectionRef floorCell = firstMatching(refs, ref -> ref instanceof DungeonSelectionRef.FloorCellRef);
        if (floorCell != null) {
            return floorCell;
        }
        return firstMatching(refs, ref ->
                ref instanceof DungeonSelectionRef.ConnectionRef
                        || ref instanceof DungeonSelectionRef.RoomRef
                        || ref instanceof DungeonSelectionRef.CorridorRef);
    }

    private static DungeonSelectionRef resolveDeleteRef(List<DungeonSelectionRef> refs) {
        DungeonSelectionRef localConnection = firstMatching(refs, ref ->
                ref instanceof DungeonSelectionRef.ConnectionRef connection
                        && connection.connectionKind() == features.world.dungeonmap.model.structures.connection.ConnectionKind.LOCAL);
        if (localConnection != null) {
            return localConnection;
        }
        return firstMatching(refs, ref -> corridorId(ref) != null);
    }

    private static boolean isExteriorBoundary(DungeonLayout layout, DungeonSelectionRef.RoomBoundaryRef ref, int levelZ) {
        DungeonLayout.RoomBoundaryDescription boundary = layout == null ? null : layout.describeRoomBoundary(ref, levelZ);
        return boundary != null && boundary.exterior();
    }

    private static DungeonSelectionRef firstMatching(
            List<DungeonSelectionRef> refs,
            java.util.function.Predicate<DungeonSelectionRef> predicate
    ) {
        if (refs == null || predicate == null) {
            return null;
        }
        for (DungeonSelectionRef ref : refs) {
            if (ref != null && predicate.test(ref)) {
                return ref;
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
