package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.cluster.application.DungeonClusterApplicationService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.map.application.DungeonMapLoadingService;
import features.world.dungeonmap.map.model.DungeonLayout;
import features.world.dungeonmap.geometry.GridSegment;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.structure.model.boundary.door.DoorRef;
import features.world.dungeonmap.cluster.model.RoomCluster;
import features.world.dungeonmap.model.structures.connection.Connection;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.shell.editor.EditorCards;
import features.world.dungeonmap.state.DungeonEditorTool;
import features.world.dungeonmap.map.state.DungeonMapState;
import features.world.dungeonmap.state.EditorInteractionState;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import ui.async.UiErrorReporter;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Editor tool for room-wall door edits.
 *
 * <p>Door placement, selection, and deletion for room-owned doors stay here so door gestures do not leak into generic
 * selection or corridor tooling.</p>
 */
public final class DoorTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonClusterApplicationService roomApplicationService;
    private final EditorInteractionState state;

    private final Label summaryLabel = new Label();
    private final Label detailLabel = new Label();
    private final Label metaLabel = new Label();
    private final VBox doorCard = EditorCards.card("Tür", new VBox(6, summaryLabel, detailLabel, metaLabel));

    private DungeonEditorTool activeTool;
    private Runnable refreshCallback = () -> { };

    public DoorTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonClusterApplicationService roomApplicationService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.roomApplicationService = Objects.requireNonNull(roomApplicationService, "roomApplicationService");
        this.state = Objects.requireNonNull(state, "state");
        summaryLabel.setWrapText(true);
        detailLabel.setWrapText(true);
        metaLabel.setWrapText(true);
        this.state.addListener(this::refreshStatePane);
        this.mapState.addListener(this::refreshStatePane);
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(DungeonEditorTool.DOOR);
    }

    @Override
    public void activate(DungeonEditorTool tool) {
        activeTool = tool;
        refreshStatePane();
    }

    @Override
    public void deactivate() {
        activeTool = null;
        refreshStatePane();
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (activeTool != DungeonEditorTool.DOOR || event == null) {
            return false;
        }
        DungeonLayout layout = ctx.activeMap();
        DungeonSelectionRef hit = ctx.hitRef();
        if (event.isSecondaryButton()) {
            return handleDeletePressed(layout, hit);
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
        if (activeTool != DungeonEditorTool.DOOR || ctx == null) {
            return List.of();
        }
        DungeonLayout layout = ctx.activeMap();
        int levelZ = ctx.probe() == null ? mapState.activeProjectionLevel() : ctx.probe().levelZ();
        return List.of(
                EditorCapabilities.part(ref ->
                        ref instanceof DungeonSelectionRef.DoorRef doorRef
                                && doorDescription(layout, doorRef, levelZ, DungeonLayout.DoorDescription::isRoomLocal) != null),
                EditorCapabilities.part(ref ->
                        ref instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary
                                && layout.existingExteriorRoomDoor(roomBoundary, levelZ) != null),
                EditorCapabilities.part(ref ->
                        ref instanceof DungeonSelectionRef.DoorRef doorRef
                                && doorDescription(layout, doorRef, levelZ, DungeonLayout.DoorDescription::isRoomExterior) != null),
                EditorCapabilities.part(ref ->
                        ref instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary
                                && isEditableLocalDoorBoundary(
                                roomBoundary,
                                layout == null ? null : layout.describeRoomBoundary(roomBoundary, levelZ),
                                layout,
                                levelZ)),
                EditorCapabilities.part(ref ->
                        ref instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary
                                && ConnectionSurfaceSupport.isExteriorRoomBoundary(layout, roomBoundary, levelZ)));
    }

    @Override
    public Node statePaneContent() {
        if (activeTool == null) {
            return null;
        }
        Connection selectedLocalDoor = selectedLocalDoor();
        if (selectedLocalDoor != null) {
            renderLocalDoorPane(selectedLocalDoor);
            return doorCard;
        }
        DungeonSelectionRef.DoorRef selectedExteriorDoor = selectedExteriorDoorRef();
        if (selectedExteriorDoor != null) {
            renderExteriorDoorPane(selectedExteriorDoor);
            return doorCard;
        }
        return null;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
        refreshCallback = callback == null ? () -> { } : callback;
    }

    private boolean handleCreatePressed(EditorToolContext ctx, DungeonLayout layout, DungeonSelectionRef hit) {
        if (layout == null || hit == null) {
            return false;
        }
        int levelZ = ctx == null || ctx.probe() == null ? mapState.activeProjectionLevel() : ctx.probe().levelZ();
        if (hit instanceof DungeonSelectionRef.DoorRef doorHit
                && doorDescription(layout, doorHit, levelZ, DungeonLayout.DoorDescription::isRoomLocal) != null) {
            applySelection(ctx.resolvedRef());
            return true;
        }
        if (hit instanceof DungeonSelectionRef.DoorRef doorHit
                && doorDescription(layout, doorHit, levelZ, DungeonLayout.DoorDescription::isRoomExterior) != null) {
            state.selectRef(doorHit);
            return true;
        }
        if (!(hit instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundaryHit)) {
            return false;
        }
        DungeonLayout.RoomBoundaryDescription boundary = layout.describeRoomBoundary(roomBoundaryHit, levelZ);
        if (boundary == null || boundary.clusterId() == null) {
            return false;
        }
        if (layout.existingExteriorRoomDoor(roomBoundaryHit, levelZ) != null) {
            state.selectRef(layout.doorSelectionRefAt(levelZ, roomBoundaryHit.boundarySegment2x()));
            return true;
        }
        if (boundary.exterior()) {
            createExteriorDoor(
                    boundary.clusterId(),
                    levelZ,
                    roomBoundaryHit.boundarySegment2x(),
                    roomBoundaryHit.boundarySegment2x());
            return true;
        }
        if (!isEditableLocalDoorBoundary(roomBoundaryHit, boundary, layout, levelZ)) {
            return false;
        }
        createLocalDoor(boundary.clusterId(), levelZ, roomBoundaryHit.boundarySegment2x(),
                roomBoundaryHit.boundarySegment2x());
        return true;
    }

    private boolean handleDeletePressed(DungeonLayout layout, DungeonSelectionRef hit) {
        if (layout == null || hit == null) {
            return false;
        }
        int levelZ = mapState.activeProjectionLevel();
        if (hit instanceof DungeonSelectionRef.DoorRef doorHit) {
            DungeonLayout.DoorDescription localDoor = doorDescription(
                    layout,
                    doorHit,
                    levelZ,
                    DungeonLayout.DoorDescription::isRoomLocal);
            if (localDoor != null) {
                deleteLocalDoor(localDoor.clusterId(), levelZ, localDoor.anchorSegment());
                return true;
            }
            DungeonLayout.DoorDescription exteriorDoor = doorDescription(
                    layout,
                    doorHit,
                    levelZ,
                    DungeonLayout.DoorDescription::isRoomExterior);
            if (exteriorDoor == null) {
                return false;
            }
            Room room = findRoom(layout, exteriorDoor.roomId());
            if (room == null) {
                return false;
            }
            deleteExteriorDoor(room.clusterId(), levelZ, exteriorDoor.anchorSegment());
            return true;
        }
        if (!(hit instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundaryHit)) {
            return false;
        }
        DungeonLayout.RoomBoundaryDescription boundary = layout.describeRoomBoundary(roomBoundaryHit, levelZ);
        if (boundary == null || boundary.clusterId() == null
                || layout.existingExteriorRoomDoor(roomBoundaryHit, levelZ) == null) {
            return false;
        }
        deleteExteriorDoor(boundary.clusterId(), levelZ, roomBoundaryHit.boundarySegment2x());
        return true;
    }

    private void createLocalDoor(Long clusterId, int levelZ, GridSegment segment2x, GridSegment followUpSegment2x) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || clusterId == null || segment2x == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    roomApplicationService.createDoor(mapId, clusterId, levelZ, List.of(segment2x));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                    DungeonSelectionRef followUpRef = mapState.activeMap() == null
                            ? null
                            : mapState.activeMap().doorSelectionRefAt(levelZ, followUpSegment2x);
                    if (followUpRef != null) {
                        state.selectRef(followUpRef);
                    } else {
                        state.clearSelection();
                    }
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("DoorTool.createLocalDoor()", throwable));
    }

    private void deleteLocalDoor(Long clusterId, int levelZ, GridSegment segment2x) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || clusterId == null || segment2x == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    roomApplicationService.deleteDoor(mapId, clusterId, levelZ, List.of(segment2x));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.clearSelection(),
                throwable -> UiErrorReporter.reportBackgroundFailure("DoorTool.deleteLocalDoor()", throwable));
    }

    private void createExteriorDoor(Long clusterId, int levelZ, GridSegment segment2x, GridSegment followUpSegment2x) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || clusterId == null || segment2x == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    roomApplicationService.createExteriorDoor(mapId, clusterId, levelZ, List.of(segment2x));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                    DungeonSelectionRef followUpRef = mapState.activeMap() == null
                            ? null
                            : mapState.activeMap().doorSelectionRefAt(levelZ, followUpSegment2x);
                    if (followUpRef != null) {
                        state.selectRef(followUpRef);
                    } else {
                        state.clearSelection();
                    }
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("DoorTool.createExteriorDoor()", throwable));
    }

    private void deleteExteriorDoor(Long clusterId, int levelZ, GridSegment segment2x) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || clusterId == null || segment2x == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    roomApplicationService.deleteExteriorDoor(mapId, clusterId, levelZ, List.of(segment2x));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.clearSelection(),
                throwable -> UiErrorReporter.reportBackgroundFailure("DoorTool.deleteExteriorDoor()", throwable));
    }

    private void renderLocalDoorPane(Connection connection) {
        summaryLabel.setText("Tür");
        detailLabel.setText(connection.endpoints().stream()
                .map(this::endpointLabel)
                .filter(label -> label != null && !label.isBlank())
                .collect(Collectors.joining(", ")));
        metaLabel.setText(segmentText(connection == null ? null : connection.anchorSegment(mapState.activeMap())));
    }

    private void renderExteriorDoorPane(DungeonSelectionRef.DoorRef doorRef) {
        DungeonLayout layout = mapState.activeMap();
        DungeonLayout.DoorDescription description = layout.describeDoor(doorRef);
        Room room = description == null ? null : findRoom(layout, description.roomId());
        summaryLabel.setText("Außentür");
        detailLabel.setText(room == null ? "Raum" : roomName(room.roomId()));
        metaLabel.setText(segmentText(description == null ? null : description.anchorSegment()));
    }

    private Connection selectedLocalDoor() {
        DungeonLayout layout = mapState.activeMap();
        if (!(state.selectedRef() instanceof DungeonSelectionRef.DoorRef doorRef)
                || doorDescription(layout, doorRef, mapState.activeProjectionLevel(), DungeonLayout.DoorDescription::isRoomLocal) == null) {
            return null;
        }
        return layout.connectionForDoor(doorRef);
    }

    private DungeonSelectionRef.DoorRef selectedExteriorDoorRef() {
        DungeonLayout layout = mapState.activeMap();
        return state.selectedRef() instanceof DungeonSelectionRef.DoorRef doorRef
                && doorDescription(layout, doorRef, mapState.activeProjectionLevel(), DungeonLayout.DoorDescription::isRoomExterior) != null
                ? doorRef
                : null;
    }

    private static DungeonLayout.DoorDescription doorDescription(
            DungeonLayout layout,
            DungeonSelectionRef.DoorRef doorRef,
            int levelZ,
            java.util.function.Predicate<DungeonLayout.DoorDescription> predicate
    ) {
        DungeonLayout.DoorDescription description = layout == null || doorRef == null ? null : layout.describeDoor(doorRef);
        return description != null
                && description.levelZ() == levelZ
                && predicate.test(description)
                ? description
                : null;
    }

    private boolean isEditableLocalDoorBoundary(
            DungeonSelectionRef.RoomBoundaryRef hit,
            DungeonLayout.RoomBoundaryDescription boundary,
            DungeonLayout layout,
            int levelZ
    ) {
        if (hit == null || boundary == null || layout == null || boundary.clusterId() == null || boundary.exterior()) {
            return false;
        }
        RoomCluster cluster = layout.findCluster(boundary.clusterId());
        RoomCluster projectedCluster = cluster == null ? null : cluster.projectedToLevel(levelZ);
        return projectedCluster != null && projectedCluster.canCreateDoor(levelZ, hit.boundarySegment2x());
    }

    private void applySelection(DungeonSelectionRef resolvedRef) {
        if (resolvedRef != null) {
            state.selectRef(resolvedRef);
        }
    }

    private String endpointLabel(ConnectionEndpoint endpoint) {
        if (endpoint == null) {
            return "";
        }
        return switch (endpoint.type()) {
            case ROOM -> roomName(endpoint.id());
            case CORRIDOR -> endpoint.id() == null ? "Korridor" : "Korridor " + endpoint.id();
            case TRANSITION -> endpoint.id() == null ? "Übergang" : "Übergang " + endpoint.id();
        };
    }

    private String roomName(Long roomId) {
        Room room = findRoom(mapState.activeMap(), roomId);
        return room == null || room.name() == null || room.name().isBlank()
                ? "Raum " + roomId
                : room.name();
    }

    private static Room findRoom(DungeonLayout layout, Long roomId) {
        if (layout == null || roomId == null) {
            return null;
        }
        for (RoomCluster cluster : layout.clusters()) {
            Room room = cluster == null ? null : cluster.structure().roomTopology().findRoom(roomId);
            if (room != null) {
                return room;
            }
        }
        return null;
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

    private void refreshStatePane() {
        if (activeTool != null) {
            refreshCallback.run();
        }
    }

}
