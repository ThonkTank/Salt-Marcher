package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.corridor.DungeonCorridorApplicationService;
import features.world.dungeonmap.application.room.DungeonRoomApplicationService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.connection.ConnectionKind;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.shell.editor.EditorCards;
import features.world.dungeonmap.state.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorInteractionState;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import ui.async.UiErrorReporter;

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
    private final VBox card = EditorCards.card("Connections", statusLabel, selectionLabel, connectedRoomsLabel);

    private PendingEndpoint pendingEndpoint;
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
        if (tool == DungeonEditorTool.CONNECTIONS_DELETE) {
            clearPendingEndpoint();
        }
        refreshStatePane();
    }

    @Override
    public void deactivate() {
        activeTool = null;
        clearPendingEndpoint();
        refreshStatePane();
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (event == null || !event.isPrimaryButton()) {
            return false;
        }
        DungeonSelectionRef hit = ctx == null ? null : ctx.hitRef();
        DungeonLayout layout = ctx == null ? null : ctx.activeMap();
        if (sessionState.selectedTool() == DungeonEditorTool.CONNECTIONS_DELETE) {
            return handleDeletePressed(ctx, layout, hit);
        }
        return handleConnectionsPressed(ctx, layout, hit);
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
        if (hitRef == null) {
            return EditorHitResolution.none();
        }
        if (hitRef instanceof DungeonSelectionRef.RoomBoundaryRef
                || hitRef instanceof DungeonSelectionRef.ConnectionRef
                || hitRef instanceof DungeonSelectionRef.CorridorTileRef
                || hitRef instanceof DungeonSelectionRef.CorridorNodeRef
                || hitRef instanceof DungeonSelectionRef.CorridorSegmentRef) {
            return EditorHitResolution.part(hitRef);
        }
        if (hitRef instanceof DungeonSelectionRef.RoomRef || hitRef instanceof DungeonSelectionRef.CorridorRef) {
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
        statusLabel.setText(statusText());
        selectionLabel.setText(selectionText(corridor));
        connectedRoomsLabel.setText(connectedRoomsText(corridor));
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
                applyDoorEdit(boundary.clusterId(), roomBoundaryHit.boundarySegment2x(), false, ctx == null ? null : ctx.resolvedRef());
                return true;
            }
            if (!boundary.exterior()) {
                return false;
            }
            applySelection(ctx == null ? null : ctx.resolvedRef());
            CorridorEndpoint endpoint = corridorEndpoint(roomBoundaryHit, boundary);
            if (pendingEndpoint instanceof PendingTile pendingTile) {
                attachDoorToTile(endpoint, pendingTile);
                return true;
            }
            if (pendingEndpoint instanceof PendingDoor pendingDoor) {
                createDoorToDoor(pendingDoor.endpoint(), endpoint);
                return true;
            }
            pendingEndpoint = new PendingDoor(endpoint);
            refreshStatePane();
            return true;
        }
        if (hit instanceof DungeonSelectionRef.CorridorTileRef corridorTileHit) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            PendingTile pendingTile = new PendingTile(
                    corridorTileHit.corridorId(),
                    corridorTileHit.cell().projectedCell());
            if (pendingEndpoint instanceof PendingDoor pendingDoor) {
                attachDoorToTile(pendingDoor.endpoint(), pendingTile);
                return true;
            }
            pendingEndpoint = pendingTile;
            refreshStatePane();
            return true;
        }
        if (hit instanceof DungeonSelectionRef.ConnectionRef
                || hit instanceof DungeonSelectionRef.CorridorRef
                || hit instanceof DungeonSelectionRef.RoomRef
                || hit instanceof DungeonSelectionRef.CorridorNodeRef
                || hit instanceof DungeonSelectionRef.CorridorSegmentRef) {
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
                && connectionHit.connectionKind() == ConnectionKind.LOCAL) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            applyDoorEdit(
                    connectionHit.clusterId(),
                    connectionHit.boundarySegment2x(),
                    true,
                    clusterOwnerRef(connectionHit.clusterId()));
            return true;
        }
        if (hit instanceof DungeonSelectionRef.ConnectionRef connectionHit
                && connectionHit.connectionKind() == ConnectionKind.CORRIDOR
                && connectionHit.corridorId() != null) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            deleteCorridorDoor(connectionHit.corridorId(), connectionHit.boundarySegment2x());
            return true;
        }
        if (hit instanceof DungeonSelectionRef.CorridorNodeRef corridorNodeHit
                && corridorNodeHit.corridorId() != null
                && corridorNodeHit.nodeId() != null) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            deleteCorridorNode(corridorNodeHit.corridorId(), corridorNodeHit.nodeId());
            return true;
        }
        if (hit instanceof DungeonSelectionRef.CorridorSegmentRef corridorSegmentHit
                && corridorSegmentHit.corridorId() != null
                && corridorSegmentHit.segmentId() != null) {
            applySelection(ctx == null ? null : ctx.resolvedRef());
            deleteCorridorSegment(corridorSegmentHit.corridorId(), corridorSegmentHit.segmentId());
            return true;
        }
        return false;
    }

    private void createDoorToDoor(CorridorEndpoint start, CorridorEndpoint end) {
        if (start == null || end == null) {
            return;
        }
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> corridorApplicationService.createDoorToDoor(new DungeonCorridorApplicationService.CreateDoorToDoorRequest(
                        mapId,
                        mapState.activeProjectionLevel(),
                        start.asRequestEndpoint(),
                        end.asRequestEndpoint())),
                createdId -> mapId,
                createdId -> {
                    clearPendingEndpoint();
                    state.selectRef(corridorOwnerRef(createdId));
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.createDoorToDoor()", throwable));
    }

    private void attachDoorToTile(CorridorEndpoint endpoint, PendingTile pendingTile) {
        if (endpoint == null || pendingTile == null || pendingTile.corridorId() == null || pendingTile.tileCell() == null) {
            return;
        }
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    corridorApplicationService.attachDoorToCorridorTile(new DungeonCorridorApplicationService.AttachDoorToCorridorTileRequest(
                            mapId,
                            pendingTile.corridorId(),
                            mapState.activeProjectionLevel(),
                            endpoint.asRequestEndpoint(),
                            pendingTile.tileCell()));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                    clearPendingEndpoint();
                    state.selectRef(corridorOwnerRef(pendingTile.corridorId()));
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.attachDoorToTile()", throwable));
    }

    private void deleteCorridorNode(Long corridorId, Long nodeId) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || corridorId == null || nodeId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    corridorApplicationService.deleteNode(new DungeonCorridorApplicationService.DeleteCorridorNodeRequest(
                            mapId,
                            corridorId,
                            nodeId));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.clearSelection(),
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.deleteCorridorNode()", throwable));
    }

    private void deleteCorridorSegment(Long corridorId, Long segmentId) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || corridorId == null || segmentId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    corridorApplicationService.deleteSegment(new DungeonCorridorApplicationService.DeleteCorridorSegmentRequest(
                            mapId,
                            corridorId,
                            segmentId));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.clearSelection(),
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.deleteCorridorSegment()", throwable));
    }

    private void deleteCorridorDoor(Long corridorId, GridSegment2x boundarySegment2x) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || corridorId == null || boundarySegment2x == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    corridorApplicationService.deleteDoor(new DungeonCorridorApplicationService.DeleteCorridorDoorRequest(
                            mapId,
                            corridorId,
                            boundarySegment2x));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.clearSelection(),
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.deleteCorridorDoor()", throwable));
    }

    private void applyDoorEdit(
            Long clusterId,
            GridSegment2x segment2x,
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
        if (pendingEndpoint == null) {
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
            DungeonSelectionRef corridorTile = firstMatching(refs, ref -> ref instanceof DungeonSelectionRef.CorridorTileRef);
            if (corridorTile != null) {
                return corridorTile;
            }
            return firstMatching(refs, ref ->
                    ref instanceof DungeonSelectionRef.ConnectionRef
                            || ref instanceof DungeonSelectionRef.RoomRef
                            || ref instanceof DungeonSelectionRef.CorridorRef);
        }
        if (pendingEndpoint instanceof PendingDoor) {
            DungeonSelectionRef corridorTile = firstMatching(refs, ref -> ref instanceof DungeonSelectionRef.CorridorTileRef);
            if (corridorTile != null) {
                return corridorTile;
            }
            DungeonSelectionRef exteriorBoundary = firstMatching(refs, ref ->
                    ref instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary
                            && isExteriorBoundary(layout, roomBoundary, levelZ));
            if (exteriorBoundary != null) {
                return exteriorBoundary;
            }
            return firstMatching(refs, ref ->
                    ref instanceof DungeonSelectionRef.ConnectionRef
                            || ref instanceof DungeonSelectionRef.RoomRef
                            || ref instanceof DungeonSelectionRef.CorridorRef);
        }
        DungeonSelectionRef exteriorBoundary = firstMatching(refs, ref ->
                ref instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary
                        && isExteriorBoundary(layout, roomBoundary, levelZ));
        if (exteriorBoundary != null) {
            return exteriorBoundary;
        }
        DungeonSelectionRef corridorTile = firstMatching(refs, ref -> ref instanceof DungeonSelectionRef.CorridorTileRef);
        if (corridorTile != null) {
            return corridorTile;
        }
        return firstMatching(refs, ref ->
                ref instanceof DungeonSelectionRef.ConnectionRef
                        || ref instanceof DungeonSelectionRef.RoomRef
                        || ref instanceof DungeonSelectionRef.CorridorRef);
    }

    private static DungeonSelectionRef resolveDeleteRef(List<DungeonSelectionRef> refs) {
        DungeonSelectionRef localConnection = firstMatching(refs, ref ->
                ref instanceof DungeonSelectionRef.ConnectionRef connection
                        && connection.connectionKind() == ConnectionKind.LOCAL);
        if (localConnection != null) {
            return localConnection;
        }
        DungeonSelectionRef corridorDoor = firstMatching(refs, ref ->
                ref instanceof DungeonSelectionRef.ConnectionRef connection
                        && connection.connectionKind() == ConnectionKind.CORRIDOR);
        if (corridorDoor != null) {
            return corridorDoor;
        }
        DungeonSelectionRef corridorNode = firstMatching(refs, ref -> ref instanceof DungeonSelectionRef.CorridorNodeRef);
        if (corridorNode != null) {
            return corridorNode;
        }
        return firstMatching(refs, ref -> ref instanceof DungeonSelectionRef.CorridorSegmentRef);
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

    private void clearPendingEndpoint() {
        pendingEndpoint = null;
        refreshStatePane();
    }

    private Corridor selectedCorridor() {
        return mapState.activeMap().corridor(state.selectedRef());
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

    private String statusText() {
        if (activeTool == DungeonEditorTool.CONNECTIONS_DELETE) {
            return "Segment, Node oder Corridor-Tür anklicken.";
        }
        return switch (pendingEndpoint) {
            case PendingDoor ignored -> "Jetzt Außenwand oder Corridor-Tile anklicken.";
            case PendingTile ignored -> "Jetzt Außenwand anklicken.";
            case null -> "Außenwand oder Corridor-Tile anklicken.";
        };
    }

    private String selectionText(Corridor corridor) {
        if (activeTool == DungeonEditorTool.CONNECTIONS_DELETE) {
            Long selectedNodeId = selectedNodeId();
            if (selectedNodeId != null) {
                return "Löschen: Node " + selectedNodeId;
            }
            Long selectedSegmentId = selectedSegmentId();
            if (selectedSegmentId != null) {
                return "Löschen: Segment " + selectedSegmentId;
            }
            if (state.selectedRef() instanceof DungeonSelectionRef.ConnectionRef connectionRef
                    && connectionRef.connectionKind() == ConnectionKind.CORRIDOR) {
                return "Löschen: Corridor-Tür";
            }
        }
        Long selectedNodeId = selectedNodeId();
        if (selectedNodeId != null) {
            return "Gewählter Node: " + selectedNodeId;
        }
        Long selectedSegmentId = selectedSegmentId();
        if (selectedSegmentId != null) {
            return "Gewähltes Segment: " + selectedSegmentId;
        }
        if (pendingEndpoint instanceof PendingDoor pendingDoor) {
            return "Start: " + roomName(pendingDoor.endpoint().roomId());
        }
        if (pendingEndpoint instanceof PendingTile pendingTile) {
            return "Start-Tile: " + pendingTile.tileCell().x() + "," + pendingTile.tileCell().y();
        }
        return corridor == null ? "Kein Corridor gewählt" : "Gewählter Corridor: " + corridor.corridorId();
    }

    private String connectedRoomsText(Corridor corridor) {
        if (corridor == null) {
            return "";
        }
        String rooms = corridor.connectedRoomIds().stream()
                .map(this::roomName)
                .collect(Collectors.joining(", "));
        return rooms.isBlank() ? "" : "Verbunden: " + rooms;
    }

    private String roomName(Long roomId) {
        Room room = roomId == null ? null : mapState.activeMap().findRoom(roomId);
        return room == null ? "Raum " + roomId : room.name();
    }

    private void refreshStatePane() {
        if (activeTool != null) {
            refreshCallback.run();
        }
    }

    private static CorridorEndpoint corridorEndpoint(
            DungeonSelectionRef.RoomBoundaryRef hit,
            DungeonLayout.RoomBoundaryDescription boundary
    ) {
        return new CorridorEndpoint(hit.roomId(), boundary.roomCell(), boundary.outwardDirection());
    }

    private static DungeonSelectionRef corridorOwnerRef(Long corridorId) {
        return corridorId == null ? null : new DungeonSelectionRef.CorridorRef(corridorId);
    }

    private static DungeonSelectionRef clusterOwnerRef(Long clusterId) {
        return clusterId == null ? null : new DungeonSelectionRef.ClusterRef(clusterId);
    }

    private sealed interface PendingEndpoint permits PendingDoor, PendingTile {
    }

    private record PendingDoor(CorridorEndpoint endpoint) implements PendingEndpoint {
    }

    private record PendingTile(Long corridorId, CellCoord tileCell) implements PendingEndpoint {
    }

    private record CorridorEndpoint(Long roomId, CellCoord roomCell, features.world.dungeonmap.model.geometry.CardinalDirection outwardDirection) {
        private DungeonCorridorApplicationService.CorridorDoorEndpoint asRequestEndpoint() {
            return new DungeonCorridorApplicationService.CorridorDoorEndpoint(roomId, roomCell, outwardDirection);
        }
    }
}
