package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import org.jspecify.annotations.Nullable;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.ApplyDungeonSurfaceEditCommand;
import src.domain.dungeon.published.CreateDungeonMapCommand;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonSurfaceEdit;
import src.domain.dungeon.published.DungeonSurfaceKind;
import src.domain.dungeon.published.DungeonSurfacePayload;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.LoadDungeonSurfaceQuery;
import src.domain.dungeon.published.PreviewDungeonSurfaceEditQuery;
import src.domain.dungeon.published.RenameDungeonMapCommand;
import src.domain.dungeon.published.SearchMapsQuery;
import src.view.slotcontent.controls.dungeoncontrol.DungeonLevelOverlayControlsView;
import src.view.slotcontent.main.dungeonmap.DungeonMapPresentationModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;
import src.view.slotcontent.primitives.mapcanvas.CanvasPointerEvent;

final class DungeonEditorBinder {

    private final ShellRuntimeContext runtimeContext;

    DungeonEditorBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        DungeonApplicationService dungeon = runtimeContext.services().require(DungeonApplicationService.class);
        DungeonEditorPresentationModel presentationModel = new DungeonEditorPresentationModel();
        DungeonEditorIntentHandler intentHandler = new DungeonEditorIntentHandler(presentationModel);
        DungeonEditorControlsView controls = new DungeonEditorControlsView();
        DungeonMapView main = new DungeonMapView();
        DungeonEditorStateView state = new DungeonEditorStateView();
        main.bind(presentationModel.mapPresentationModel());
        main.onPrimaryPressed(event -> intentHandler.primaryPressed(
                toPointerInput(event, presentationModel.mapPresentationModel().renderStateProperty().get())));
        main.onPrimaryDragged(event -> intentHandler.primaryDragged(
                toPointerInput(event, presentationModel.mapPresentationModel().renderStateProperty().get())));
        main.onPrimaryReleased(event -> intentHandler.primaryReleased(
                toPointerInput(event, presentationModel.mapPresentationModel().renderStateProperty().get())));
        main.onPointerMoved(event -> intentHandler.pointerMoved(
                toPointerInput(event, presentationModel.mapPresentationModel().renderStateProperty().get())));
        main.onLevelScrolled(intentHandler::levelScrolled);
        state.stateTextProperty().bind(presentationModel.stateProperty());
        state.setOnSaveRoomNarration(edit -> intentHandler.saveRoomNarration(
                edit.roomId(),
                edit.visualDescription(),
                edit.exits().stream().map(DungeonEditorBinder::toRoomExitNarrationInput).toList()));
        controls.setOnMapSelected(intentHandler::selectMap);
        controls.setOnCreateMap(intentHandler::createMap);
        controls.setOnRenameMap(request -> intentHandler.renameMap(request.key(), request.mapName()));
        controls.setOnDeleteMap(intentHandler::deleteMap);
        controls.onViewModeChanged(mode -> intentHandler.selectViewMode(toViewModeKey(mode)));
        controls.onToolChanged(intentHandler::selectTool);
        controls.onPreviousLevel(intentHandler::previousLevel);
        controls.onNextLevel(intentHandler::nextLevel);
        controls.levelOverlayControls()
                .setOnModeChanged(mode -> intentHandler.selectOverlayMode(toOverlayModeKey(mode)));
        controls.levelOverlayControls().setOnRangeChanged(intentHandler::selectOverlayRange);
        controls.levelOverlayControls().setOnOpacityChanged(intentHandler::selectOverlayOpacity);
        controls.levelOverlayControls().setOnSelectedLevelsChanged(intentHandler::selectOverlayLevels);
        intentHandler.onActionRequested(action -> handleActionIntent(action, presentationModel, dungeon));
        presentationModel.inspectorProperty().addListener((ignored, before, after) -> syncStateView(presentationModel, state));
        presentationModel.mapsProperty().addListener((ignored, before, after) -> syncMapControls(presentationModel, controls));
        presentationModel.selectedMapKeyProperty().addListener((ignored, before, after) -> syncMapControls(presentationModel, controls));
        presentationModel.busyProperty().addListener((ignored, before, after) -> syncMapControls(presentationModel, controls));
        presentationModel.viewModeProperty().addListener((ignored, before, after) -> {
            controls.showViewMode(toControlsViewMode(after));
        });
        presentationModel.selectedToolProperty().addListener((ignored, before, after) -> {
            controls.showTool(after);
        });
        presentationModel.projectionLevelProperty().addListener((ignored, before, after) -> {
            controls.showLevels(
                    presentationModel.reachableLevelsProperty().get(),
                    after.intValue(),
                    presentationModel.busyProperty().get(),
                    presentationModel.selectedMapKeyProperty().get() != null
                            && !presentationModel.selectedMapKeyProperty().get().isBlank());
        });
        presentationModel.reachableLevelsProperty().addListener((ignored, before, after) ->
                controls.showLevels(
                        after,
                        presentationModel.projectionLevelProperty().get(),
                        presentationModel.busyProperty().get(),
                        presentationModel.selectedMapKeyProperty().get() != null
                                && !presentationModel.selectedMapKeyProperty().get().isBlank()));
        presentationModel.overlaySettingsProperty().addListener((ignored, before, after) -> {
            controls.showOverlaySettings(toControlsOverlaySettings(after), presentationModel.busyProperty().get());
        });
        presentationModel.statusProperty().addListener((ignored, before, after) -> syncMapControls(presentationModel, controls));
        presentationModel.statusProperty().addListener((ignored, before, after) -> syncStateView(presentationModel, state));
        presentationModel.busyProperty().addListener((ignored, before, after) -> syncStateView(presentationModel, state));
        syncMapControls(presentationModel, controls);
        syncStateView(presentationModel, state);
        controls.showViewMode(toControlsViewMode(presentationModel.viewModeProperty().get()));
        controls.showTool(presentationModel.selectedToolProperty().get());
        controls.showLevels(
                presentationModel.reachableLevelsProperty().get(),
                presentationModel.projectionLevelProperty().get(),
                presentationModel.busyProperty().get(),
                false);
        controls.showOverlaySettings(
                toControlsOverlaySettings(presentationModel.overlaySettingsProperty().get()),
                presentationModel.busyProperty().get());
        intentHandler.refresh();
        return new Binding(controls, main, state);
    }

    private static DungeonEditorPresentationModel.PointerInput toPointerInput(
            CanvasPointerEvent event,
            DungeonMapPresentationModel.RenderState renderState
    ) {
        int level = renderState == null ? 0 : renderState.projectionLevel();
        if (event == null) {
            return new DungeonEditorPresentationModel.PointerInput(
                    0,
                    0,
                    level,
                    false,
                    false,
                    emptyHitTarget(),
                    DungeonEditorPresentationModel.VertexTarget.empty(),
                    DungeonEditorPresentationModel.BoundaryTarget.empty());
        }
        int q = (int) Math.floor(event.canvasPoint().x());
        int r = (int) Math.floor(event.canvasPoint().y());
        return new DungeonEditorPresentationModel.PointerInput(
                q,
                r,
                level,
                event.buttons().primaryButtonDown(),
                event.buttons().secondaryButtonDown(),
                toHitTarget(event.hit(), renderState),
                toVertexTarget(event.canvasPoint(), level),
                toBoundaryTarget(event.canvasPoint(), renderState, level));
    }

    private static DungeonEditorPresentationModel.HitTarget toHitTarget(
            CanvasPointerEvent.@Nullable CanvasHit hit,
            DungeonMapPresentationModel.RenderState renderState
    ) {
        if (hit == null || hit.hitRef().isBlank() || renderState == null) {
            return emptyHitTarget();
        }
        String hitRef = hit.hitRef();
        if (hitRef.startsWith("cell:")) {
            return toCellHit(renderState, parseIndex(hitRef));
        }
        if (hitRef.startsWith("edge:")) {
            return toEdgeHit(renderState, parseIndex(hitRef));
        }
        if (hitRef.startsWith("label:")) {
            return toLabelHit(renderState, parseIndex(hitRef));
        }
        if (hitRef.startsWith("marker:")) {
            return toMarkerHit(renderState, parseIndex(hitRef));
        }
        if (hitRef.startsWith("graph-node:")) {
            return toGraphNodeHit(renderState, parseIndex(hitRef));
        }
        return emptyHitTarget();
    }

    private static DungeonEditorPresentationModel.HitTarget toCellHit(
            DungeonMapPresentationModel.RenderState renderState,
            int index
    ) {
        if (index < 0 || index >= renderState.cells().size()) {
            return emptyHitTarget();
        }
        DungeonMapPresentationModel.RenderState.RenderCell cell = renderState.cells().get(index);
        DungeonEditorPresentationModel.HitKind kind = switch (cell.kind()) {
            case ROOM -> DungeonEditorPresentationModel.HitKind.ROOM;
            case CORRIDOR -> DungeonEditorPresentationModel.HitKind.CORRIDOR;
            case STAIR -> DungeonEditorPresentationModel.HitKind.STAIR;
            case TRANSITION -> DungeonEditorPresentationModel.HitKind.TRANSITION;
        };
        return new DungeonEditorPresentationModel.HitTarget(
                kind,
                cell.ownerId(),
                cell.clusterId(),
                cell.topologyRef().kind(),
                cell.topologyRef().id(),
                cell.label(),
                emptyHandleRef(cell.ownerId(), cell.clusterId()));
    }

    private static DungeonEditorPresentationModel.HitTarget toEdgeHit(
            DungeonMapPresentationModel.RenderState renderState,
            int index
    ) {
        if (index < 0 || index >= renderState.edges().size()) {
            return emptyHitTarget();
        }
        DungeonMapPresentationModel.RenderState.RenderEdge edge = renderState.edges().get(index);
        return new DungeonEditorPresentationModel.HitTarget(
                DungeonEditorPresentationModel.HitKind.BOUNDARY,
                edge.ownerId(),
                0L,
                edge.topologyRef().kind(),
                edge.topologyRef().id(),
                edge.label(),
                emptyHandleRef(edge.ownerId(), 0L));
    }

    private static DungeonEditorPresentationModel.HitTarget toLabelHit(
            DungeonMapPresentationModel.RenderState renderState,
            int index
    ) {
        if (index < 0 || index >= renderState.labels().size()) {
            return emptyHitTarget();
        }
        DungeonMapPresentationModel.RenderState.RenderLabel label = renderState.labels().get(index);
        return new DungeonEditorPresentationModel.HitTarget(
                DungeonEditorPresentationModel.HitKind.LABEL,
                label.ownerId(),
                label.clusterId(),
                label.topologyRef().kind(),
                label.topologyRef().id(),
                label.label(),
                emptyHandleRef(label.ownerId(), label.clusterId()));
    }

    private static DungeonEditorPresentationModel.HitTarget toMarkerHit(
            DungeonMapPresentationModel.RenderState renderState,
            int index
    ) {
        if (index < 0 || index >= renderState.markers().size()) {
            return emptyHitTarget();
        }
        DungeonMapPresentationModel.RenderState.RenderMarker marker = renderState.markers().get(index);
        return new DungeonEditorPresentationModel.HitTarget(
                DungeonEditorPresentationModel.HitKind.HANDLE,
                marker.handleOwnerId(),
                marker.handleClusterId(),
                marker.handleTopologyRefKind(),
                marker.handleTopologyRefId(),
                marker.label(),
                new DungeonEditorPresentationModel.HandleTarget(
                        marker.handleKind(),
                        marker.handleTopologyRefKind(),
                        marker.handleTopologyRefId(),
                        marker.handleOwnerId(),
                        marker.handleClusterId(),
                        marker.handleRoomId(),
                        marker.handleOwnerId(),
                        marker.handleIndex(),
                        new DungeonEditorPresentationModel.CellTarget(
                                marker.handleQ(),
                                marker.handleR(),
                                marker.handleLevel()),
                        marker.label()));
    }

    private static DungeonEditorPresentationModel.HitTarget toGraphNodeHit(
            DungeonMapPresentationModel.RenderState renderState,
            int index
    ) {
        if (index < 0 || index >= renderState.graphNodes().size()) {
            return emptyHitTarget();
        }
        DungeonMapPresentationModel.RenderState.GraphNode node = renderState.graphNodes().get(index);
        return new DungeonEditorPresentationModel.HitTarget(
                DungeonEditorPresentationModel.HitKind.LABEL,
                node.id(),
                node.clusterId(),
                "ROOM",
                node.id(),
                node.label(),
                emptyHandleRef(node.id(), node.clusterId()));
    }

    private static DungeonEditorPresentationModel.VertexTarget toVertexTarget(
            CanvasPointerEvent.CanvasPoint point,
            int level
    ) {
        int vertexQ = (int) Math.round(point.x());
        int vertexR = (int) Math.round(point.y());
        double distance = Math.hypot(point.x() - vertexQ, point.y() - vertexR);
        return distance <= 0.22
                ? new DungeonEditorPresentationModel.VertexTarget(true, vertexQ, vertexR, level)
                : DungeonEditorPresentationModel.VertexTarget.empty();
    }

    private static DungeonEditorPresentationModel.BoundaryTarget toBoundaryTarget(
            CanvasPointerEvent.CanvasPoint point,
            DungeonMapPresentationModel.RenderState renderState,
            int level
    ) {
        if (renderState == null) {
            return DungeonEditorPresentationModel.BoundaryTarget.empty();
        }
        java.util.Map<CellKey, DungeonMapPresentationModel.RenderState.RenderCell> roomCellsByPosition =
                roomCellsByPosition(renderState, level);
        DungeonEditorPresentationModel.BoundaryTarget bestTarget =
                DungeonEditorPresentationModel.BoundaryTarget.empty();
        double bestDistance = 0.22;
        for (int index = renderState.edges().size() - 1; index >= 0; index--) {
            DungeonMapPresentationModel.RenderState.RenderEdge edge = renderState.edges().get(index);
            if (edge.preview() || edge.z() != level) {
                continue;
            }
            BoundaryCells touchingRooms = boundaryCells(edge, roomCellsByPosition);
            if (touchingRooms == null) {
                continue;
            }
            double distance = distanceToSegment(
                    point.x(),
                    point.y(),
                    edge.startQ(),
                    edge.startR(),
                    edge.endQ(),
                    edge.endR());
            if (distance > bestDistance) {
                continue;
            }
            bestDistance = distance;
            bestTarget = new DungeonEditorPresentationModel.BoundaryTarget(
                    true,
                    edge.kind().name(),
                    touchingRooms.ownerId(),
                    touchingRooms.clusterId(),
                    edge.topologyRef().kind(),
                    edge.topologyRef().id(),
                    touchingRooms.start(),
                    touchingRooms.end());
        }
        return bestTarget;
    }

    private static java.util.Map<CellKey, DungeonMapPresentationModel.RenderState.RenderCell> roomCellsByPosition(
            DungeonMapPresentationModel.RenderState renderState,
            int level
    ) {
        java.util.Map<CellKey, DungeonMapPresentationModel.RenderState.RenderCell> result = new java.util.LinkedHashMap<>();
        for (DungeonMapPresentationModel.RenderState.RenderCell cell : renderState.cells()) {
            if (cell.preview()
                    || cell.z() != level
                    || cell.kind() != DungeonMapPresentationModel.RenderState.CellKind.ROOM
                    || cell.clusterId() <= 0L) {
                continue;
            }
            result.put(new CellKey(cell.q(), cell.r()), cell);
        }
        return result;
    }

    private static @Nullable BoundaryCells boundaryCells(
            DungeonMapPresentationModel.RenderState.RenderEdge edge,
            java.util.Map<CellKey, DungeonMapPresentationModel.RenderState.RenderCell> roomCellsByPosition
    ) {
        if (edge == null || roomCellsByPosition.isEmpty()) {
            return null;
        }
        int startQ = (int) Math.round(edge.startQ());
        int startR = (int) Math.round(edge.startR());
        int endQ = (int) Math.round(edge.endQ());
        int endR = (int) Math.round(edge.endR());
        java.util.List<DungeonMapPresentationModel.RenderState.RenderCell> touchingRooms = new java.util.ArrayList<>();
        if (startQ == endQ) {
            addIfPresent(touchingRooms, roomCellsByPosition.get(new CellKey(startQ - 1, Math.min(startR, endR))));
            addIfPresent(touchingRooms, roomCellsByPosition.get(new CellKey(startQ, Math.min(startR, endR))));
        } else if (startR == endR) {
            addIfPresent(touchingRooms, roomCellsByPosition.get(new CellKey(Math.min(startQ, endQ), startR - 1)));
            addIfPresent(touchingRooms, roomCellsByPosition.get(new CellKey(Math.min(startQ, endQ), startR)));
        }
        if (touchingRooms.isEmpty()) {
            return null;
        }
        DungeonMapPresentationModel.RenderState.RenderCell clusterCell = touchingRooms.stream()
                .filter(cell -> cell.clusterId() > 0L)
                .findFirst()
                .orElse(null);
        if (clusterCell == null) {
            return null;
        }
        return new BoundaryCells(
                clusterCell.ownerId(),
                clusterCell.clusterId(),
                new DungeonEditorPresentationModel.CellTarget(startQ, startR, edge.z()),
                new DungeonEditorPresentationModel.CellTarget(endQ, endR, edge.z()));
    }

    private static void addIfPresent(
            java.util.List<DungeonMapPresentationModel.RenderState.RenderCell> target,
            DungeonMapPresentationModel.RenderState.@Nullable RenderCell cell
    ) {
        if (cell != null) {
            target.add(cell);
        }
    }

    private static int parseIndex(String hitRef) {
        int separator = hitRef.indexOf(':');
        if (separator < 0 || separator + 1 >= hitRef.length()) {
            return -1;
        }
        try {
            return Integer.parseInt(hitRef.substring(separator + 1));
        } catch (NumberFormatException ignored) {
            return -1;
        }
    }

    private static DungeonEditorPresentationModel.HitTarget emptyHitTarget() {
        return new DungeonEditorPresentationModel.HitTarget(
                DungeonEditorPresentationModel.HitKind.EMPTY,
                0L,
                0L,
                "EMPTY",
                0L,
                "",
                DungeonEditorPresentationModel.HandleTarget.empty());
    }

    private static DungeonEditorPresentationModel.HandleTarget emptyHandleRef(long ownerId, long clusterId) {
        return DungeonEditorPresentationModel.HandleTarget.clusterLabel("EMPTY", 0L, ownerId, clusterId);
    }

    private static double distanceToSegment(
            double pointX,
            double pointY,
            double startX,
            double startY,
            double endX,
            double endY
    ) {
        double deltaX = endX - startX;
        double deltaY = endY - startY;
        double lengthSquared = deltaX * deltaX + deltaY * deltaY;
        if (lengthSquared <= 0.0) {
            return Math.hypot(pointX - startX, pointY - startY);
        }
        double factor = ((pointX - startX) * deltaX + (pointY - startY) * deltaY) / lengthSquared;
        double clampedFactor = Math.max(0.0, Math.min(1.0, factor));
        double nearestX = startX + clampedFactor * deltaX;
        double nearestY = startY + clampedFactor * deltaY;
        return Math.hypot(pointX - nearestX, pointY - nearestY);
    }

    private record CellKey(int q, int r) {
    }

    private record BoundaryCells(
            long ownerId,
            long clusterId,
            DungeonEditorPresentationModel.CellTarget start,
            DungeonEditorPresentationModel.CellTarget end
    ) {
    }

    private static void handleActionIntent(
            DungeonEditorPresentationModel.ActionIntent request,
            DungeonEditorPresentationModel presentationModel,
            DungeonApplicationService dungeon
    ) {
        if (request == null) {
            return;
        }
        try {
            switch (request.kind()) {
                case REFRESH -> handleRefreshRequest(presentationModel, dungeon);
                case LOAD_SELECTED_MAP -> loadSelectedMap(presentationModel, dungeon, request.mapId());
                case CREATE_MAP -> handleCreateMapRequest(request, presentationModel, dungeon);
                case RENAME_MAP -> handleRenameMapRequest(request, presentationModel, dungeon);
                case DELETE_MAP -> handleDeleteMapRequest(request, presentationModel, dungeon);
                case SAVE_ROOM_NARRATION -> handleSaveRoomNarrationRequest(request, presentationModel, dungeon);
                case MOVE_SELECTED_HANDLE -> handleMoveSelectedHandleRequest(request, presentationModel, dungeon);
                case PREVIEW_SURFACE_EDIT -> handlePreviewSurfaceEditRequest(request, presentationModel, dungeon);
                case APPLY_BOUNDARY_STRETCH -> handleBoundaryStretchRequest(request, presentationModel, dungeon);
                case APPLY_OPERATION -> handleApplyOperationRequest(request, presentationModel, dungeon);
                case REFRESH_INSPECTOR -> handleRefreshInspectorRequest(request, presentationModel, dungeon);
            }
        } catch (RuntimeException exception) {
            presentationModel.applyActionFailure(DungeonEditorPresentationModel.rootCauseMessage(exception));
            presentationModel.finishBusy();
        }
    }

    private static void handleRefreshRequest(
            DungeonEditorPresentationModel presentationModel,
            DungeonApplicationService dungeon
    ) {
        presentationModel.applyMapSelections(loadMapSelections(dungeon));
        loadSelectedMap(presentationModel, dungeon, presentationModel.selectedMapId());
        presentationModel.finishBusy();
    }

    private static void handleCreateMapRequest(
            DungeonEditorPresentationModel.ActionIntent request,
            DungeonEditorPresentationModel presentationModel,
            DungeonApplicationService dungeon
    ) {
        DungeonMapId createdMapId = dungeon.createMap(new CreateDungeonMapCommand(request.mapName())).mapId();
        presentationModel.selectMapId(createdMapId);
        presentationModel.applyMapSelections(loadMapSelections(dungeon));
        loadSelectedMap(presentationModel, dungeon, presentationModel.selectedMapId());
        presentationModel.finishBusy();
    }

    private static void handleRenameMapRequest(
            DungeonEditorPresentationModel.ActionIntent request,
            DungeonEditorPresentationModel presentationModel,
            DungeonApplicationService dungeon
    ) {
        DungeonMapId renamedMapId = dungeon.renameMap(new RenameDungeonMapCommand(
                Objects.requireNonNull(request.mapId(), "request.mapId"),
                request.mapName())).mapId();
        presentationModel.selectMapId(renamedMapId);
        presentationModel.applyMapSelections(loadMapSelections(dungeon));
        loadSelectedMap(presentationModel, dungeon, presentationModel.selectedMapId());
        presentationModel.finishBusy();
    }

    private static void handleDeleteMapRequest(
            DungeonEditorPresentationModel.ActionIntent request,
            DungeonEditorPresentationModel presentationModel,
            DungeonApplicationService dungeon
    ) {
        DungeonMapId deletedMapId = Objects.requireNonNull(request.mapId(), "request.mapId");
        dungeon.deleteMap(new DeleteDungeonMapCommand(deletedMapId));
        presentationModel.clearSelectionForDeletedMap(deletedMapId);
        presentationModel.applyMapSelections(loadMapSelections(dungeon));
        loadSelectedMap(presentationModel, dungeon, presentationModel.selectedMapId());
        presentationModel.finishBusy();
    }

    private static void handleSaveRoomNarrationRequest(
            DungeonEditorPresentationModel.ActionIntent request,
            DungeonEditorPresentationModel presentationModel,
            DungeonApplicationService dungeon
    ) {
        DungeonSurfacePayload result = dungeon.applySurfaceEdit(new ApplyDungeonSurfaceEditCommand(
                Objects.requireNonNull(request.mapId(), "request.mapId"),
                toSurfaceEdit(Objects.requireNonNull(request.surfaceMutation(), "request.surfaceMutation"))));
        presentationModel.applyRoomNarrationSaved(result);
        refreshInspectorIfAvailable(presentationModel, dungeon);
        presentationModel.finishBusy();
    }

    private static void handleMoveSelectedHandleRequest(
            DungeonEditorPresentationModel.ActionIntent request,
            DungeonEditorPresentationModel presentationModel,
            DungeonApplicationService dungeon
    ) {
        DungeonEditorPresentationModel.DragSession dragSession =
                Objects.requireNonNull(request.dragSession(), "request.dragSession");
        DungeonSurfacePayload result = dungeon.applySurfaceEdit(new ApplyDungeonSurfaceEditCommand(
                Objects.requireNonNull(request.mapId(), "request.mapId"),
                toSurfaceEdit(Objects.requireNonNull(request.surfaceMutation(), "request.surfaceMutation"))));
        presentationModel.applyMoveSelectedHandleResult(result, dragSession);
        refreshInspectorIfAvailable(presentationModel, dungeon);
        presentationModel.finishBusy();
    }

    private static void handlePreviewSurfaceEditRequest(
            DungeonEditorPresentationModel.ActionIntent request,
            DungeonEditorPresentationModel presentationModel,
            DungeonApplicationService dungeon
    ) {
        DungeonSurfacePayload previewSurface = dungeon.previewSurfaceEdit(new PreviewDungeonSurfaceEditQuery(
                Objects.requireNonNull(request.mapId(), "request.mapId"),
                toSurfaceEdit(Objects.requireNonNull(request.surfaceMutation(), "request.surfaceMutation"))));
        presentationModel.applyPreviewSurface(previewSurface);
    }

    private static void handleBoundaryStretchRequest(
            DungeonEditorPresentationModel.ActionIntent request,
            DungeonEditorPresentationModel presentationModel,
            DungeonApplicationService dungeon
    ) {
        DungeonEditorPresentationModel.BoundaryStretchSession boundaryStretchSession =
                Objects.requireNonNull(request.boundaryStretchSession(), "request.boundaryStretchSession");
        DungeonSurfacePayload result = dungeon.applySurfaceEdit(new ApplyDungeonSurfaceEditCommand(
                Objects.requireNonNull(request.mapId(), "request.mapId"),
                toSurfaceEdit(Objects.requireNonNull(request.surfaceMutation(), "request.surfaceMutation"))));
        presentationModel.applyBoundaryStretchResult(result, boundaryStretchSession);
        refreshInspectorIfAvailable(presentationModel, dungeon);
        presentationModel.finishBusy();
    }

    private static void handleApplyOperationRequest(
            DungeonEditorPresentationModel.ActionIntent request,
            DungeonEditorPresentationModel presentationModel,
            DungeonApplicationService dungeon
    ) {
        DungeonSurfacePayload result = dungeon.applySurfaceEdit(new ApplyDungeonSurfaceEditCommand(
                Objects.requireNonNull(request.mapId(), "request.mapId"),
                toSurfaceEdit(Objects.requireNonNull(request.surfaceMutation(), "request.surfaceMutation"))));
        presentationModel.applyCommittedOperationResult(result, request.statusText());
        presentationModel.finishBusy();
    }

    private static void handleRefreshInspectorRequest(
            DungeonEditorPresentationModel.ActionIntent request,
            DungeonEditorPresentationModel presentationModel,
            DungeonApplicationService dungeon
    ) {
        DungeonSurfacePayload inspectorSurface = dungeon.loadSurface(new LoadDungeonSurfaceQuery(
                Objects.requireNonNull(request.mapId(), "request.mapId"),
                request.surfaceKind() == null ? DungeonSurfaceKind.EDITOR : request.surfaceKind(),
                Objects.requireNonNull(request.topologyRef(), "request.topologyRef"),
                request.clusterId(),
                request.clusterSelection(),
                null));
        presentationModel.applyInspectorSurface(
                inspectorSurface,
                request.surfaceKind() == null ? DungeonSurfaceKind.EDITOR : request.surfaceKind());
    }

    private static DungeonSurfaceEdit toSurfaceEdit(DungeonEditorPresentationModel.SurfaceMutation mutation) {
        return new DungeonSurfaceEdit(toOperation(mutation));
    }

    private static DungeonEditorOperation toOperation(DungeonEditorPresentationModel.SurfaceMutation mutation) {
        Objects.requireNonNull(mutation, "mutation");
        return switch (mutation) {
            case DungeonEditorPresentationModel.RoomRectangleMutation room ->
                    room.deleteMode()
                            ? new DungeonEditorOperation.DeleteRoomRectangle(room.start(), room.end())
                            : new DungeonEditorOperation.PaintRoomRectangle(room.start(), room.end());
            case DungeonEditorPresentationModel.ClusterBoundariesMutation boundaries ->
                    new DungeonEditorOperation.EditClusterBoundaries(
                            boundaries.clusterId(),
                            boundaries.edges(),
                            boundaries.boundaryKind(),
                            boundaries.deleteMode());
            case DungeonEditorPresentationModel.SaveRoomNarrationMutation narration ->
                    new DungeonEditorOperation.SaveRoomNarration(
                            narration.roomId(),
                            narration.visualDescription(),
                            narration.exits().stream().map(DungeonEditorBinder::toPublishedExit).toList());
            case DungeonEditorPresentationModel.MoveHandleMutation moveHandle ->
                    new DungeonEditorOperation.MoveEditorHandle(
                            moveHandle.handleRef(),
                            moveHandle.deltaQ(),
                            moveHandle.deltaR(),
                            moveHandle.deltaLevel());
            case DungeonEditorPresentationModel.MoveBoundaryStretchMutation stretch ->
                    new DungeonEditorOperation.MoveBoundaryStretch(
                            stretch.clusterId(),
                            stretch.sourceEdges(),
                            stretch.deltaQ(),
                            stretch.deltaR(),
                            stretch.deltaLevel());
        };
    }

    private static List<DungeonEditorPresentationModel.MapSelection> loadMapSelections(
            DungeonApplicationService dungeon
    ) {
        return dungeon.searchMaps(new SearchMapsQuery("")).maps().stream()
                .map(DungeonEditorBinder::toMapSelection)
                .toList();
    }

    private static void loadSelectedMap(
            DungeonEditorPresentationModel presentationModel,
            DungeonApplicationService dungeon,
            @Nullable DungeonMapId mapId
    ) {
        if (mapId == null) {
            presentationModel.applyNoSelectedMapAvailable();
            return;
        }
        try {
            presentationModel.applyLoadedSelectedMap(dungeon.loadSurface(new LoadDungeonSurfaceQuery(
                    mapId,
                    DungeonSurfaceKind.EDITOR)));
            refreshInspectorIfAvailable(presentationModel, dungeon);
        } catch (RuntimeException exception) {
            presentationModel.applySelectedMapLoadFailure(DungeonEditorPresentationModel.rootCauseMessage(exception));
        }
    }

    private static void refreshInspectorIfAvailable(
            DungeonEditorPresentationModel presentationModel,
            DungeonApplicationService dungeon
    ) {
        DungeonEditorPresentationModel.InspectorRequest inspectorRequest = presentationModel.currentInspectorRequest();
        if (inspectorRequest == null) {
            return;
        }
        DungeonSurfacePayload inspectorSurface = dungeon.loadSurface(new LoadDungeonSurfaceQuery(
                inspectorRequest.mapId(),
                inspectorRequest.surfaceKind(),
                inspectorRequest.topologyRef(),
                inspectorRequest.clusterId(),
                inspectorRequest.clusterSelection(),
                null));
        presentationModel.applyInspectorSurface(inspectorSurface, inspectorRequest.surfaceKind());
    }

    private static void syncMapControls(
            DungeonEditorPresentationModel presentationModel,
            DungeonEditorControlsView controls
    ) {
        boolean hasMap = presentationModel.selectedMapKeyProperty().get() != null
                && !presentationModel.selectedMapKeyProperty().get().isBlank();
        boolean busy = presentationModel.busyProperty().get();
        controls.showMaps(
                presentationModel.mapsProperty().get().stream().map(DungeonEditorBinder::toControlMapItem).toList(),
                presentationModel.selectedMapKeyProperty().get(),
                busy,
                presentationModel.statusProperty().get());
        controls.showLevels(
                presentationModel.reachableLevelsProperty().get(),
                presentationModel.projectionLevelProperty().get(),
                busy,
                hasMap);
        controls.showOverlaySettings(toControlsOverlaySettings(presentationModel.overlaySettingsProperty().get()), busy);
    }

    private static void syncStateView(
            DungeonEditorPresentationModel presentationModel,
            DungeonEditorStateView state
    ) {
        DungeonInspectorSnapshot inspector = presentationModel.inspectorProperty().get();
        state.showNarrationCards(
                inspector == null
                        ? java.util.List.of()
                        : inspector.roomNarrations().stream().map(DungeonEditorBinder::toStateCard).toList(),
                presentationModel.busyProperty().get(),
                presentationModel.statusProperty().get());
    }

    private static DungeonEditorStateView.RoomNarrationCard toStateCard(
            DungeonInspectorSnapshot.RoomNarrationCard card
    ) {
        return new DungeonEditorStateView.RoomNarrationCard(
                card.roomId(),
                card.roomName(),
                card.visualDescription(),
                card.exits().stream().map(DungeonEditorBinder::toStateExit).toList());
    }

    private static DungeonEditorStateView.RoomExitNarration toStateExit(
            DungeonInspectorSnapshot.RoomExitNarration exit
    ) {
        return new DungeonEditorStateView.RoomExitNarration(
                exit.label(),
                exit.cell().q(),
                exit.cell().r(),
                exit.cell().level(),
                exit.direction(),
                exit.description());
    }

    private static DungeonInspectorSnapshot.RoomExitNarration toPublishedExit(
            DungeonEditorPresentationModel.RoomExitNarrationInput exit
    ) {
        return new DungeonInspectorSnapshot.RoomExitNarration(
                exit.label(),
                new DungeonCellRef(exit.q(), exit.r(), exit.level()),
                exit.direction(),
                exit.description());
    }

    private static DungeonEditorPresentationModel.RoomExitNarrationInput toRoomExitNarrationInput(
            DungeonEditorStateView.RoomExitNarration exit
    ) {
        return new DungeonEditorPresentationModel.RoomExitNarrationInput(
                exit.label(),
                exit.q(),
                exit.r(),
                exit.level(),
                exit.direction(),
                exit.description());
    }

    private static String toViewModeKey(String viewMode) {
        return DungeonEditorControlsView.VIEW_GRAPH.equals(viewMode) ? "GRAPH" : "GRID";
    }

    private static String toControlsViewMode(DungeonMapPresentationModel.RenderState.ViewMode viewMode) {
        return viewMode == DungeonMapPresentationModel.RenderState.ViewMode.GRAPH
                ? DungeonEditorControlsView.VIEW_GRAPH
                : DungeonEditorControlsView.VIEW_GRID;
    }

    private static String toOverlayModeKey(
            DungeonLevelOverlayControlsView.Mode overlayMode
    ) {
        if (overlayMode == DungeonLevelOverlayControlsView.Mode.NEARBY) {
            return "NEARBY";
        }
        if (overlayMode == DungeonLevelOverlayControlsView.Mode.SELECTED) {
            return "SELECTED";
        }
        return "OFF";
    }

    private static DungeonLevelOverlayControlsView.Settings toControlsOverlaySettings(
            DungeonMapPresentationModel.RenderState.LevelOverlaySettings settings
    ) {
        if (settings == null) {
            return new DungeonLevelOverlayControlsView.Settings(
                    DungeonLevelOverlayControlsView.Mode.OFF,
                    2,
                    0.35,
                    java.util.List.of());
        }
        DungeonLevelOverlayControlsView.Mode mode = toControlsOverlayMode(settings.mode());
        return new DungeonLevelOverlayControlsView.Settings(
                mode,
                settings.levelRange(),
                settings.opacity(),
                settings.selectedLevels());
    }

    private static DungeonLevelOverlayControlsView.Mode toControlsOverlayMode(
            DungeonMapPresentationModel.RenderState.OverlayMode overlayMode
    ) {
        if (overlayMode == DungeonMapPresentationModel.RenderState.OverlayMode.NEARBY) {
            return DungeonLevelOverlayControlsView.Mode.NEARBY;
        }
        if (overlayMode == DungeonMapPresentationModel.RenderState.OverlayMode.SELECTED) {
            return DungeonLevelOverlayControlsView.Mode.SELECTED;
        }
        return DungeonLevelOverlayControlsView.Mode.OFF;
    }

    private static DungeonEditorControlsView.MapItem toControlMapItem(
            DungeonEditorPresentationModel.MapSelection selection
    ) {
        return new DungeonEditorControlsView.MapItem(
                selection.key(),
                selection.mapId() == null ? 0L : selection.mapId().value(),
                selection.mapName(),
                selection.revision());
    }

    private static DungeonEditorPresentationModel.MapSelection toMapSelection(
            src.domain.dungeon.published.DungeonMapSummary summary
    ) {
        return new DungeonEditorPresentationModel.MapSelection(
                summary.mapId() == null ? "" : Long.toString(summary.mapId().value()),
                summary.mapId(),
                summary.mapName(),
                summary.revision());
    }

    private record Binding(
            Node controls,
            Node main,
            Node state
    ) implements ShellBinding {

        @Override
        public String title() {
            return "Dungeon Editor";
        }

        @Override
        public String navigationLabel() {
            return "Dungeon";
        }

        @Override
        public Map<ShellSlot, Node> slotContent() {
            return Map.of(
                    ShellSlot.COCKPIT_CONTROLS, controls,
                    ShellSlot.COCKPIT_MAIN, main,
                    ShellSlot.COCKPIT_STATE, state);
        }
    }
}
