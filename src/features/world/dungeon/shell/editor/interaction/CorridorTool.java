package features.world.dungeon.shell.editor.interaction;

import features.world.dungeon.dungoenmap.corridor.application.DungeonCorridorApplicationService;
import features.world.dungeon.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeon.dungoenmap.application.DungeonMapLoadingService;
import features.world.dungeon.dungoenmap.model.DungeonMap;
import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.dungoenmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.dungoenmap.cluster.model.Cluster;
import features.world.dungeon.model.structures.connection.Connection;
import features.world.dungeon.model.structures.connection.ConnectionEndpoint;
import features.world.dungeon.dungoenmap.corridor.model.Corridor;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.shell.editor.EditorCards;
import features.world.dungeon.state.DungeonEditorTool;
import features.world.dungeon.dungoenmap.state.DungeonMapState;
import features.world.dungeon.state.EditorInteractionState;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import ui.async.UiErrorReporter;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Editor tool for corridor authoring and corridor graph deletion.
 *
 * <p>This tool owns the UI-side meaning of door-to-door and door-to-wall corridor gestures. Canonical corridor graph
 * validation and persistence stay in model and application owners.</p>
 */
public final class CorridorTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonCorridorApplicationService corridorApplicationService;
    private final EditorInteractionState state;

    private final Label summaryLabel = new Label();
    private final Label detailLabel = new Label();
    private final Label metaLabel = new Label();
    private final VBox connectionCard = EditorCards.card("Korridor", new VBox(6, summaryLabel, detailLabel, metaLabel));

    private PendingRoomDoor pendingEndpoint;
    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };
    private Long previousMapId;

    public CorridorTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonCorridorApplicationService corridorApplicationService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.corridorApplicationService = Objects.requireNonNull(corridorApplicationService, "corridorApplicationService");
        this.state = Objects.requireNonNull(state, "state");
        summaryLabel.setWrapText(true);
        detailLabel.setWrapText(true);
        metaLabel.setWrapText(true);
        this.state.addListener(this::refreshStatePane);
        this.mapState.addListener(this::refreshFromMapState);
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(DungeonEditorTool.CORRIDOR);
    }

    @Override
    public void activate(DungeonEditorTool tool) {
        activeTool = tool;
        refreshStatePane();
    }

    @Override
    public void deactivate() {
        activeTool = null;
        pendingEndpoint = null;
        refreshStatePane();
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (activeTool != DungeonEditorTool.CORRIDOR || event == null) {
            return false;
        }
        DungeonMap layout = ctx.activeMap();
        DungeonSelectionRef hit = ctx.hitRef();
        if (event.isSecondaryButton()) {
            return handleDeletePressed(layout, hit) || cancelPendingEndpoint();
        }
        if (!event.isPrimaryButton()) {
            return false;
        }
        return handleCreatePressed(ctx, layout, hit);
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
    public List<EditorInteractionCapability> interactionCapabilities(EditorToolContext ctx, EditorToolPhase phase) {
        if (activeTool != DungeonEditorTool.CORRIDOR || ctx == null) {
            return List.of();
        }
        DungeonMap layout = ctx.activeMap();
        int levelZ = ctx.probe() == null ? mapState.activeProjectionLevel() : ctx.probe().levelZ();
        if (pendingEndpoint == null) {
            return List.of(
                    EditorCapabilities.part(ref ->
                            ref instanceof DungeonSelectionRef.DoorRef doorRef
                                    && exteriorRoomDoor(layout, doorRef, levelZ) != null),
                    EditorCapabilities.part(ref ->
                            ref instanceof DungeonSelectionRef.DoorRef doorRef
                                    && corridorBoundaryDoor(layout, doorRef, levelZ) != null),
                    EditorCapabilities.owner(ref -> ref instanceof DungeonSelectionRef.CorridorRef));
        }
        return List.of(
                EditorCapabilities.part(ref ->
                        ref instanceof DungeonSelectionRef.CorridorBoundaryRef corridorBoundaryRef
                                && ConnectionSurfaceSupport.isAvailableCorridorBoundary(layout, corridorBoundaryRef, levelZ)),
                EditorCapabilities.part(ref ->
                        ref instanceof DungeonSelectionRef.DoorRef doorRef
                                && exteriorRoomDoor(layout, doorRef, levelZ) != null));
    }

    @Override
    public Node statePaneContent() {
        if (activeTool == null || pendingEndpoint != null) {
            return null;
        }
        Connection selectedConnection = selectedConnection();
        if (selectedConnection != null) {
            renderConnectionPane(selectedConnection, null);
            return connectionCard;
        }
        Corridor selectedCorridor = selectedCorridor();
        if (selectedCorridor != null) {
            renderConnectionPane(null, selectedCorridor);
            return connectionCard;
        }
        return null;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
        refreshCallback = callback == null ? () -> { } : callback;
    }

    private boolean handleCreatePressed(EditorToolContext ctx, DungeonMap layout, DungeonSelectionRef hit) {
        if (layout == null || hit == null) {
            return false;
        }
        int levelZ = ctx == null || ctx.probe() == null ? mapState.activeProjectionLevel() : ctx.probe().levelZ();
        if (hit instanceof DungeonSelectionRef.DoorRef doorHit) {
            DungeonMap.DoorDescription exteriorDoor = exteriorRoomDoor(layout, doorHit, levelZ);
            if (exteriorDoor == null) {
                if (hit instanceof DungeonSelectionRef.DoorRef || hit instanceof DungeonSelectionRef.CorridorRef) {
                    clearPendingEndpoint();
                    applySelection(ctx == null ? null : ctx.resolvedRef());
                    return true;
                }
                return false;
            }
            CorridorEndpoint endpoint = corridorEndpoint(doorHit);
            GridSegment anchorSegment2x = exteriorDoor.anchorSegment();
            if (pendingEndpoint != null) {
                if (Objects.equals(pendingEndpoint.boundarySegment2x(), anchorSegment2x)) {
                    return true;
                }
                createDoorToDoor(pendingEndpoint.endpoint(), endpoint);
                return true;
            }
            startPendingEndpoint(new PendingRoomDoor(endpoint, anchorSegment2x));
            return true;
        }
        if (hit instanceof DungeonSelectionRef.CorridorBoundaryRef corridorBoundaryHit) {
            if (pendingEndpoint == null
                    || layout.describeCorridorBoundary(corridorBoundaryHit, levelZ) == null) {
                return false;
            }
            attachDoorToBoundary(
                    pendingEndpoint.endpoint(),
                    corridorBoundaryHit.corridorId(),
                    corridorBoundaryHit.boundarySegment());
            return true;
        }
        if (hit instanceof DungeonSelectionRef.CorridorRef) {
            clearPendingEndpoint();
            applySelection(ctx == null ? null : ctx.resolvedRef());
            return true;
        }
        return false;
    }

    private boolean handleDeletePressed(DungeonMap layout, DungeonSelectionRef hit) {
        if (layout == null || hit == null) {
            return false;
        }
        if (hit instanceof DungeonSelectionRef.DoorRef doorHit) {
            DungeonMap.DoorDescription description = corridorBoundaryDoor(layout, doorHit, mapState.activeProjectionLevel());
            if (description == null) {
                return false;
            }
            deleteCorridorDoor(description == null ? null : description.corridorId(), anchorSegment(layout, doorHit));
            return true;
        }
        if (hit instanceof DungeonSelectionRef.CorridorNodeRef corridorNodeHit
                && corridorNodeHit.corridorId() != null
                && corridorNodeHit.nodeId() != null) {
            deleteCorridorNode(corridorNodeHit.corridorId(), corridorNodeHit.nodeId());
            return true;
        }
        if (hit instanceof DungeonSelectionRef.CorridorSegmentRef corridorSegmentHit
                && corridorSegmentHit.corridorId() != null
                && corridorSegmentHit.segmentId() != null) {
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
                        start.doorRef(),
                        end.doorRef())),
                createdId -> mapId,
                createdId -> {
                    clearPendingEndpoint();
                    state.selectRef(corridorOwnerRef(createdId));
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("CorridorTool.createDoorToDoor()", throwable));
    }

    private void attachDoorToBoundary(CorridorEndpoint endpoint, Long corridorId, GridSegment boundarySegment2x) {
        if (endpoint == null || corridorId == null || boundarySegment2x == null) {
            return;
        }
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    corridorApplicationService.attachDoorToCorridorBoundary(
                            new DungeonCorridorApplicationService.AttachDoorToCorridorBoundaryRequest(
                                    mapId,
                                    corridorId,
                                    endpoint.doorRef(),
                                    boundarySegment2x));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                    clearPendingEndpoint();
                    state.selectRef(corridorOwnerRef(corridorId));
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("CorridorTool.attachDoorToBoundary()", throwable));
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
                throwable -> UiErrorReporter.reportBackgroundFailure("CorridorTool.deleteCorridorNode()", throwable));
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
                throwable -> UiErrorReporter.reportBackgroundFailure("CorridorTool.deleteCorridorSegment()", throwable));
    }

    private void deleteCorridorDoor(Long corridorId, GridSegment boundarySegment2x) {
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
                throwable -> UiErrorReporter.reportBackgroundFailure("CorridorTool.deleteCorridorDoor()", throwable));
    }

    private void renderConnectionPane(Connection connection, Corridor corridor) {
        if (connection != null) {
            summaryLabel.setText("Korridoranschluss");
            detailLabel.setText(connection.endpoints().stream()
                    .map(this::endpointLabel)
                    .filter(label -> label != null && !label.isBlank())
                    .collect(Collectors.joining(", ")));
            metaLabel.setText(segmentText(connection.anchorSegment(mapState.activeMap())));
            return;
        }
        if (corridor == null) {
            summaryLabel.setText("");
            detailLabel.setText("");
            metaLabel.setText("");
            return;
        }
        summaryLabel.setText(corridorLabel(corridor.corridorId()));
        detailLabel.setText("Nodes: " + corridor.nodes().size() + " · Segmente: " + corridor.segments().size());
        metaLabel.setText(connectedRoomsText(corridor));
    }

    private void refreshFromMapState() {
        boolean mapChanged = !Objects.equals(previousMapId, mapState.activeMapId());
        previousMapId = mapState.activeMapId();
        if (mapChanged) {
            pendingEndpoint = null;
        }
        refreshStatePane();
    }

    private void refreshStatePane() {
        if (activeTool != null) {
            refreshCallback.run();
        }
    }

    private void applySelection(DungeonSelectionRef resolvedRef) {
        if (resolvedRef != null) {
            state.selectRef(resolvedRef);
        }
    }

    private boolean cancelPendingEndpoint() {
        if (pendingEndpoint == null) {
            return false;
        }
        clearPendingEndpoint();
        state.clearSelection();
        return true;
    }

    private void startPendingEndpoint(PendingRoomDoor endpoint) {
        pendingEndpoint = endpoint;
        state.clearSelection();
        refreshStatePane();
    }

    private void clearPendingEndpoint() {
        pendingEndpoint = null;
        refreshStatePane();
    }

    private Connection selectedConnection() {
        DungeonMap layout = mapState.activeMap();
        if (!(state.selectedRef() instanceof DungeonSelectionRef.DoorRef doorRef)
                || corridorBoundaryDoor(layout, doorRef, mapState.activeProjectionLevel()) == null) {
            return null;
        }
        return layout.connectionForDoor(doorRef);
    }

    private Corridor selectedCorridor() {
        return mapState.activeMap().corridor(state.selectedRef());
    }

    private String endpointLabel(ConnectionEndpoint endpoint) {
        if (endpoint == null) {
            return "";
        }
        return switch (endpoint.type()) {
            case ROOM -> roomName(endpoint.id());
            case CORRIDOR -> corridorLabel(endpoint.id());
            case TRANSITION -> endpoint.id() == null ? "Übergang" : "Übergang " + endpoint.id();
        };
    }

    private String roomName(Long roomId) {
        Room room = findRoom(mapState.activeMap(), roomId);
        return room == null || room.name() == null || room.name().isBlank()
                ? "Raum " + roomId
                : room.name();
    }

    private static Room findRoom(DungeonMap layout, Long roomId) {
        if (layout == null || roomId == null) {
            return null;
        }
        for (Cluster cluster : layout.clusters()) {
            Room room = cluster == null ? null : cluster.roomTopology().findRoom(roomId);
            if (room != null) {
                return room;
            }
        }
        return null;
    }

    private String corridorLabel(Long corridorId) {
        return corridorId == null ? "Korridor" : "Korridor " + corridorId;
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

    private static String segmentText(GridSegment segment2x) {
        if (segment2x == null) {
            return "";
        }
        return "Segment: "
                + segment2x.start().x2() + "," + segment2x.start().y2()
                + " → "
                + segment2x.end().x2() + "," + segment2x.end().y2();
    }

    private static DungeonSelectionRef corridorOwnerRef(Long corridorId) {
        return corridorId == null ? null : new DungeonSelectionRef.CorridorRef(corridorId);
    }

    private static CorridorEndpoint corridorEndpoint(
            DungeonSelectionRef.DoorRef hit
    ) {
        return hit == null ? null : new CorridorEndpoint(new DoorRef(hit.doorId()));
    }

    private static DungeonMap.DoorDescription exteriorRoomDoor(
            DungeonMap layout,
            DungeonSelectionRef.DoorRef doorRef,
            int levelZ
    ) {
        DungeonMap.DoorDescription description = layout == null || doorRef == null ? null : layout.describeDoor(doorRef);
        return description != null && description.levelZ() == levelZ && description.isRoomExterior()
                ? description
                : null;
    }

    private static DungeonMap.DoorDescription corridorBoundaryDoor(
            DungeonMap layout,
            DungeonSelectionRef.DoorRef doorRef,
            int levelZ
    ) {
        DungeonMap.DoorDescription description = layout == null || doorRef == null ? null : layout.describeDoor(doorRef);
        return description != null && description.levelZ() == levelZ && description.isCorridorBoundary()
                ? description
                : null;
    }

    private static GridSegment anchorSegment(
            DungeonMap layout,
            DungeonSelectionRef.DoorRef doorRef
    ) {
        DungeonMap.DoorDescription description = layout == null || doorRef == null ? null : layout.describeDoor(doorRef);
        return description == null ? null : description.anchorSegment();
    }

    private record PendingRoomDoor(
            CorridorEndpoint endpoint,
            GridSegment boundarySegment2x
    ) {
    }

    private record CorridorEndpoint(DoorRef doorRef) {
    }
}
