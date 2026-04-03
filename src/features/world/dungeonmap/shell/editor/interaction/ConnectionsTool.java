package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.corridor.DungeonCorridorEditService;
import features.world.dungeonmap.application.corridor.DungeonCorridorGraphEditor;
import features.world.dungeonmap.application.room.DungeonBoundaryEditService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.interaction.DungeonHitKind;
import features.world.dungeonmap.model.interaction.DungeonSelectionKey;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNode;
import features.world.dungeonmap.model.structures.corridor.CorridorSegment;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.shell.editor.EditorCards;
import features.world.dungeonmap.shell.interaction.DungeonHitConventions;
import features.world.dungeonmap.shell.interaction.DungeonHitSubject;
import features.world.dungeonmap.shell.interaction.DungeonSelectionLookup;
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
                ctx == null ? null : ctx.selection(),
                ctx == null ? null : ctx.activeMap(),
                ctx == null || ctx.probe() == null ? mapState.activeProjectionLevel() : ctx.probe().levelZ());
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
                applySelection(ctx == null ? null : ctx.resolvedSelectionKey());
                applyDoorEdit(
                        roomBoundaryHit.clusterId(),
                        roomBoundaryHit.boundarySegment2x(),
                        false,
                        ctx == null ? null : ctx.resolvedSelectionKey());
                return true;
            }
            if (!roomBoundaryHit.exterior()) {
                return false;
            }
            applySelection(ctx == null ? null : ctx.resolvedSelectionKey());
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
            applySelection(ctx == null ? null : ctx.resolvedSelectionKey());
            finishDraftWithCorridorNode(corridorNodeHit, layout);
            return true;
        }
        if (hit instanceof DungeonHitSubject.CorridorCornerSubject cornerHit) {
            applySelection(ctx == null ? null : ctx.resolvedSelectionKey());
            insertNode(cornerHit.corridorId(), cornerHit.segmentId(), cornerHit.point2x());
            return true;
        }
        if (hit instanceof DungeonHitSubject.CorridorSegmentSubject segmentHit) {
            applySelection(ctx == null ? null : ctx.resolvedSelectionKey());
            insertNode(segmentHit.corridorId(), segmentHit.segmentId(), segmentHit.point2x());
            return true;
        }
        if (hit instanceof DungeonHitSubject.CorridorNodeSubject nodeHit) {
            applySelection(ctx == null ? null : ctx.resolvedSelectionKey());
            return true;
        }
        if (hit instanceof DungeonHitSubject.ConnectionSubject connectionHit) {
            applySelection(ctx == null ? null : ctx.resolvedSelectionKey());
            return true;
        }
        if (hit instanceof DungeonHitSubject.RoomSubject roomHit) {
            applySelection(ctx == null ? null : ctx.resolvedSelectionKey());
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
            applySelection(ctx == null ? null : ctx.resolvedSelectionKey());
            applyDoorEdit(
                    connectionHit.clusterId(),
                    connectionHit.boundarySegment2x(),
                    true,
                    corridorOwnerlessClusterKey(connectionHit.clusterId()));
            return true;
        }
        Long corridorId = corridorId(hit);
        if (corridorId != null) {
            applySelection(ctx == null ? null : ctx.resolvedSelectionKey());
            Long mapId = mapState.activeMapId();
            if (mapId == null) {
                return true;
            }
            loadingService.submitMutation(
                () -> {
                    corridorEditService.delete(mapId, corridorId);
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
                DungeonCorridorGraphEditor.roomsById(mapState.activeMap()));
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> corridorEditService.create(mapId, planned),
                createdId -> mapId,
                createdId -> {
                    clearDraft();
                    state.selectKey(corridorOwnerKey(createdId));
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
        loadingService.submitMutation(
                () -> {
                    corridorEditService.update(mapId, updated);
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                    clearDraft();
                    state.selectKey(corridorOwnerKey(updated.corridorId()));
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("ConnectionsTool.finishDraftWithCorridorNode()", throwable));
    }

    private void insertNode(Long corridorId, Long segmentId, GridPoint2x point2x) {
        Corridor corridor = mapState.activeMap().findCorridor(corridorId);
        if (corridor == null || corridor.corridorId() == null || segmentId == null || point2x == null) {
            return;
        }
        Corridor updated = DungeonCorridorGraphEditor.withInsertedNode(mapState.activeMap(), corridor, segmentId, point2x);
        Long mapId = mapState.activeMapId();
        if (mapId == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    corridorEditService.update(mapId, updated);
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.selectKey(corridorOwnerKey(updated.corridorId())),
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
        loadingService.submitMutation(
                () -> {
                    corridorEditService.update(mapId, updated);
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.selectKey(corridorOwnerKey(updated.corridorId())),
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
                    corridorEditService.delete(mapId, corridor.corridorId());
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
            DungeonSelectionKey followUpKey
    ) {
        Long mapId = mapState.activeMapId();
        if (mapId == null || clusterId == null || segment2x == null) {
            return;
        }
        loadingService.submitMutation(
                () -> {
                    boundaryEditService.apply(
                        mapId,
                        clusterId,
                        mapState.activeProjectionLevel(),
                        segment2x,
                        InternalBoundaryType.DOOR,
                        deleteBoundary);
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> state.selectKey(followUpKey),
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
        CellCoord oppositeCell = hit.roomCell().add(hit.outwardDirection().delta());
        Room oppositeRoom = projectedCluster.roomAt(oppositeCell);
        if (sourceRoom == null || oppositeRoom == null) {
            return false;
        }
        return sourceRoom.roomId() != null
                && oppositeRoom.roomId() != null
                && !sourceRoom.roomId().equals(oppositeRoom.roomId());
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

    private DungeonHitSubject resolvedSubject(
            features.world.dungeonmap.shell.interaction.DungeonSelection selection,
            DungeonLayout layout,
            int levelZ
    ) {
        if (selection == null) {
            return null;
        }
        List<DungeonHitSubject> subjects = selection.orderedSubjects();
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

    private void applySelection(DungeonSelectionKey resolvedKey) {
        if (resolvedKey != null) {
            state.selectKey(resolvedKey);
        }
    }

    private Long selectedCorridorId() {
        Corridor corridor = DungeonSelectionLookup.corridor(mapState.activeMap(), state.selectedKey());
        return corridor == null ? null : corridor.corridorId();
    }

    private Long selectedNodeId() {
        return DungeonSelectionLookup.corridorNodeId(state.selectedKey());
    }

    private Long selectedSegmentId() {
        return DungeonSelectionLookup.corridorSegmentId(state.selectedKey());
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

    private static DungeonSelectionKey corridorOwnerKey(Long corridorId) {
        if (corridorId == null) {
            return null;
        }
        return new DungeonSelectionKey(
                DungeonHitKind.CORRIDOR,
                Corridor.targetKey(corridorId),
                DungeonHitConventions.noPartKey());
    }

    private static DungeonSelectionKey corridorOwnerlessClusterKey(Long clusterId) {
        if (clusterId == null) {
            return null;
        }
        return new DungeonSelectionKey(
                DungeonHitKind.CLUSTER_LABEL,
                features.world.dungeonmap.model.structures.cluster.RoomCluster.targetKey(clusterId),
                DungeonHitConventions.noPartKey());
    }
}
