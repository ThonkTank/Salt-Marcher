package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;
import org.jspecify.annotations.Nullable;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.ApplyDungeonSurfaceEditCommand;
import src.domain.dungeon.published.CreateDungeonMapCommand;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonEditorSnapshot;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonSurfaceEdit;
import src.domain.dungeon.published.DungeonSurfaceKind;
import src.domain.dungeon.published.DungeonSurfacePayload;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.LoadDungeonSurfaceQuery;
import src.domain.dungeon.published.PreviewDungeonSurfaceEditQuery;
import src.domain.dungeon.published.RenameDungeonMapCommand;
import src.domain.dungeon.published.SearchMapsQuery;
import src.domain.dungeon.published.SearchMapsResult;
import src.view.slotcontent.controls.dungeoncontrol.DungeonLevelOverlayControlsView;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;

final class DungeonEditorBinder {

    private final ShellRuntimeContext runtimeContext;

    DungeonEditorBinder(ShellRuntimeContext runtimeContext) {
        this.runtimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
    }

    ShellBinding bind() {
        DungeonApplicationService dungeon = runtimeContext.services().require(DungeonApplicationService.class);
        DungeonEditorContributionModel contributionModel = new DungeonEditorContributionModel();
        DungeonMapContentModel mapPresentationModel = new DungeonMapContentModel("Dungeon workspace", true);
        DungeonEditorIntentHandler intentHandler = new DungeonEditorIntentHandler(contributionModel);
        DungeonEditorControlsView controls = new DungeonEditorControlsView();
        DungeonEditorMainView main = new DungeonEditorMainView();
        DungeonEditorStateView state = new DungeonEditorStateView();

        main.bind(mapPresentationModel);
        bindMapPresentation(contributionModel, mapPresentationModel);
        bindViewEvents(intentHandler, controls, main, state);
        bindIntentHandler(intentHandler, contributionModel, dungeon);
        bindPublishedEditorState(contributionModel, controls, state);
        syncMapControls(contributionModel, controls);
        syncStateView(contributionModel, state);
        controls.showViewMode(toControlsViewMode(contributionModel.viewModeProperty().get()));
        controls.showTool(contributionModel.selectedToolProperty().get());
        controls.showLevels(
                contributionModel.reachableLevelsProperty().get(),
                contributionModel.projectionLevelProperty().get(),
                contributionModel.busyProperty().get(),
                false);
        controls.showOverlaySettings(
                toControlsOverlaySettings(contributionModel.overlaySettingsProperty().get()),
                contributionModel.busyProperty().get());
        refreshEditorSnapshot(dungeon, contributionModel, null, null, "");
        return new Binding(controls, main, state);
    }

    private static void bindMapPresentation(
            DungeonEditorContributionModel contributionModel,
            DungeonMapContentModel mapPresentationModel
    ) {
        contributionModel.snapshotProperty().addListener((ignored, before, after) -> mapPresentationModel.showSnapshot(after));
        contributionModel.previewSnapshotProperty().addListener((ignored, before, after) -> mapPresentationModel.showPreviewSnapshot(after));
        contributionModel.selectionProperty().addListener((ignored, before, after) -> mapPresentationModel.showSelection(after));
        contributionModel.pendingTopologyEditProperty().addListener((ignored, before, after) ->
                mapPresentationModel.showPendingTopologyEdit(after));
        contributionModel.viewModeProperty().addListener((ignored, before, after) -> mapPresentationModel.selectViewMode(after));
        contributionModel.overlaySettingsProperty().addListener((ignored, before, after) -> mapPresentationModel.showOverlaySettings(after));
        contributionModel.projectionLevelProperty().addListener((ignored, before, after) ->
                mapPresentationModel.showProjectionLevel(after.intValue()));
        contributionModel.selectedToolProperty().addListener((ignored, before, after) -> mapPresentationModel.showSelectedTool(after));
        mapPresentationModel.renderStateProperty().addListener((ignored, before, after) ->
                contributionModel.showInteractionRenderState(after));
        mapPresentationModel.selectViewMode(contributionModel.viewModeProperty().get());
        mapPresentationModel.showOverlaySettings(contributionModel.overlaySettingsProperty().get());
        mapPresentationModel.showProjectionLevel(contributionModel.projectionLevelProperty().get());
        mapPresentationModel.showSelectedTool(contributionModel.selectedToolProperty().get());
        contributionModel.showInteractionRenderState(mapPresentationModel.renderStateProperty().get());
    }

    private static void bindViewEvents(
            DungeonEditorIntentHandler intentHandler,
            DungeonEditorControlsView controls,
            DungeonEditorMainView main,
            DungeonEditorStateView state
    ) {
        main.onViewInputEvent(intentHandler::consume);
        controls.onViewInputEvent(intentHandler::consume);
        state.onViewInputEvent(intentHandler::consume);
    }

    private static void bindIntentHandler(
            DungeonEditorIntentHandler intentHandler,
            DungeonEditorContributionModel contributionModel,
            DungeonApplicationService dungeon
    ) {
        intentHandler.onPublishedEventRequested(event -> runAction(contributionModel, () -> {
            if (event == null) {
                return;
            }
            switch (event.kind()) {
                case LOAD_EDITOR -> refreshEditorSnapshot(
                        dungeon,
                        contributionModel,
                        toMapId(event.mapId()),
                        null,
                        "");
                case CREATE_MAP -> {
                    DungeonMapId createdMapId = dungeon.createMap(new CreateDungeonMapCommand(event.mapName())).mapId();
                    refreshEditorSnapshot(dungeon, contributionModel, createdMapId, null, "Dungeon-Map erstellt.");
                }
                case RENAME_MAP -> {
                    DungeonMapId renamedMapId = dungeon.renameMap(new RenameDungeonMapCommand(
                            requireMapId(event.mapId()),
                            event.mapName())).mapId();
                    refreshEditorSnapshot(dungeon, contributionModel, renamedMapId, null, "Dungeon-Map umbenannt.");
                }
                case DELETE_MAP -> {
                    DungeonMapId deletedMapId = dungeon.deleteMap(new src.domain.dungeon.published.DeleteDungeonMapCommand(
                            requireMapId(event.mapId()))).mapId();
                    DungeonMapId currentMapId = contributionModel.currentSelectedMapId();
                    DungeonMapId nextMapId = deletedMapId != null && deletedMapId.equals(currentMapId) ? null : currentMapId;
                    refreshEditorSnapshot(dungeon, contributionModel, nextMapId, null, "Dungeon-Map geloescht.");
                }
                case PREVIEW_SURFACE_EDIT -> refreshEditorSnapshot(
                        dungeon,
                        contributionModel,
                        toMapId(event.mapId()),
                        dungeon.previewSurfaceEdit(toPreviewSurfaceEditQuery(event)),
                        "");
                case APPLY_SURFACE_EDIT -> {
                    ApplyDungeonSurfaceEditCommand command = toApplySurfaceEditCommand(event);
                    dungeon.applySurfaceEdit(command);
                    refreshEditorSnapshot(
                            dungeon,
                            contributionModel,
                            command.mapId(),
                            null,
                            statusForEditorEdit(command.edit()));
                }
                case LOAD_SURFACE -> refreshEditorSnapshot(
                        dungeon,
                        contributionModel,
                        toMapId(event.mapId()),
                        dungeon.loadSurface(toLoadSurfaceQuery(event)),
                        contributionModel.statusProperty().get());
            }
        }));
    }

    private static void bindPublishedEditorState(
            DungeonEditorContributionModel contributionModel,
            DungeonEditorControlsView controls,
            DungeonEditorStateView state
    ) {
        state.stateTextProperty().bind(contributionModel.stateProperty());
        contributionModel.inspectorProperty().addListener((ignored, before, after) -> syncStateView(contributionModel, state));
        contributionModel.mapsProperty().addListener((ignored, before, after) -> syncMapControls(contributionModel, controls));
        contributionModel.selectedMapKeyProperty().addListener((ignored, before, after) -> syncMapControls(contributionModel, controls));
        contributionModel.busyProperty().addListener((ignored, before, after) -> syncMapControls(contributionModel, controls));
        contributionModel.viewModeProperty().addListener((ignored, before, after) ->
                controls.showViewMode(toControlsViewMode(after)));
        contributionModel.selectedToolProperty().addListener((ignored, before, after) -> controls.showTool(after));
        contributionModel.projectionLevelProperty().addListener((ignored, before, after) ->
                controls.showLevels(
                        contributionModel.reachableLevelsProperty().get(),
                        after.intValue(),
                        contributionModel.busyProperty().get(),
                        contributionModel.selectedMapKeyProperty().get() != null
                                && !contributionModel.selectedMapKeyProperty().get().isBlank()));
        contributionModel.reachableLevelsProperty().addListener((ignored, before, after) ->
                controls.showLevels(
                        after,
                        contributionModel.projectionLevelProperty().get(),
                        contributionModel.busyProperty().get(),
                        contributionModel.selectedMapKeyProperty().get() != null
                                && !contributionModel.selectedMapKeyProperty().get().isBlank()));
        contributionModel.overlaySettingsProperty().addListener((ignored, before, after) ->
                controls.showOverlaySettings(toControlsOverlaySettings(after), contributionModel.busyProperty().get()));
        contributionModel.statusProperty().addListener((ignored, before, after) -> syncMapControls(contributionModel, controls));
        contributionModel.statusProperty().addListener((ignored, before, after) -> syncStateView(contributionModel, state));
        contributionModel.busyProperty().addListener((ignored, before, after) -> syncStateView(contributionModel, state));
    }

    private static void runAction(
            DungeonEditorContributionModel contributionModel,
            Runnable action
    ) {
        try {
            action.run();
        } catch (RuntimeException exception) {
            contributionModel.applyActionFailure(DungeonEditorContributionModel.rootCauseMessage(exception));
            contributionModel.finishBusy();
        }
    }

    private static void refreshEditorSnapshot(
            DungeonApplicationService dungeon,
            DungeonEditorContributionModel contributionModel,
            @Nullable DungeonMapId preferredMapId,
            @Nullable DungeonSurfacePayload surfaceOverride,
            String statusText
    ) {
        SearchMapsResult mapsResult = dungeon.searchMaps(new SearchMapsQuery(""));
        List<DungeonMapSummary> maps = mapsResult == null ? List.of() : mapsResult.maps();
        DungeonMapId requestedMapId = preferredMapId == null ? contributionModel.currentSelectedMapId() : preferredMapId;
        DungeonMapId selectedMapId = resolveSelectedMapId(requestedMapId, maps);
        DungeonSurfacePayload surface = surfaceOverride == null && selectedMapId != null
                ? dungeon.loadSurface(new LoadDungeonSurfaceQuery(selectedMapId, DungeonSurfaceKind.EDITOR))
                : surfaceOverride;
        contributionModel.applyEditorSnapshot(new DungeonEditorSnapshot(maps, selectedMapId, surface, statusText));
    }

    private static PreviewDungeonSurfaceEditQuery toPreviewSurfaceEditQuery(DungeonEditorPublishedEvent event) {
        return new PreviewDungeonSurfaceEditQuery(
                toMapId(event.mapId()),
                toSurfaceEdit(event.mutation()));
    }

    private static ApplyDungeonSurfaceEditCommand toApplySurfaceEditCommand(DungeonEditorPublishedEvent event) {
        return new ApplyDungeonSurfaceEditCommand(
                toMapId(event.mapId()),
                toSurfaceEdit(event.mutation()));
    }

    private static LoadDungeonSurfaceQuery toLoadSurfaceQuery(DungeonEditorPublishedEvent event) {
        DungeonEditorPublishedEvent.InspectorSelection selection = event.inspectorSelection();
        return new LoadDungeonSurfaceQuery(
                toMapId(event.mapId()),
                selection == null
                        ? DungeonSurfaceKind.EDITOR
                        : DungeonSurfaceKind.valueOf(selection.surfaceKind()),
                selection == null
                        ? DungeonTopologyElementRef.empty()
                        : new DungeonTopologyElementRef(
                        DungeonTopologyElementKind.valueOf(selection.topologyRefKind()),
                        selection.topologyRefId()),
                selection == null ? 0L : selection.clusterId(),
                selection != null && selection.clusterSelection(),
                null);
    }

    private static @Nullable DungeonMapId toMapId(long mapId) {
        return mapId <= 0L ? null : new DungeonMapId(mapId);
    }

    private static DungeonMapId requireMapId(long mapId) {
        DungeonMapId resolvedMapId = toMapId(mapId);
        if (resolvedMapId == null) {
            throw new IllegalArgumentException("Dungeon-Map-ID fehlt.");
        }
        return resolvedMapId;
    }

    private static @Nullable DungeonSurfaceEdit toSurfaceEdit(DungeonEditorPublishedEvent.Mutation mutation) {
        if (mutation == null || mutation instanceof DungeonEditorPublishedEvent.NoneMutation) {
            return null;
        }
        return new DungeonSurfaceEdit(toOperation(mutation));
    }

    private static String statusForEditorEdit(@Nullable DungeonSurfaceEdit edit) {
        DungeonEditorOperation operation = edit == null ? null : edit.operation();
        if (operation instanceof DungeonEditorOperation.SaveRoomNarration) {
            return "Raumbeschreibung gespeichert.";
        }
        if (operation instanceof DungeonEditorOperation.MoveEditorHandle moveHandle) {
            return "Topologieelement verschoben: dq=" + moveHandle.deltaQ()
                    + ", dr=" + moveHandle.deltaR()
                    + ", dz=" + moveHandle.deltaLevel();
        }
        if (operation instanceof DungeonEditorOperation.MoveBoundaryStretch stretch) {
            return "Wandstrecke verschoben: dq=" + stretch.deltaQ()
                    + ", dr=" + stretch.deltaR()
                    + ", dz=" + stretch.deltaLevel();
        }
        if (operation instanceof DungeonEditorOperation.PaintRoomRectangle) {
            return "Raum hinzugefuegt.";
        }
        if (operation instanceof DungeonEditorOperation.DeleteRoomRectangle) {
            return "Raum entfernt.";
        }
        if (operation instanceof DungeonEditorOperation.EditClusterBoundaries boundaries) {
            return boundaries.deleteBoundary() ? "Kanten geloescht." : "Kanten gesetzt.";
        }
        return "";
    }

    private static @Nullable DungeonMapId resolveSelectedMapId(
            @Nullable DungeonMapId requestedMapId,
            List<DungeonMapSummary> maps
    ) {
        if (requestedMapId != null && maps.stream().anyMatch(summary -> requestedMapId.equals(summary.mapId()))) {
            return requestedMapId;
        }
        return maps.isEmpty() ? null : maps.getFirst().mapId();
    }

    private static DungeonEditorOperation toOperation(DungeonEditorPublishedEvent.Mutation mutation) {
        return switch (mutation) {
            case DungeonEditorPublishedEvent.RoomRectangleMutation room ->
                    room.deleteMode()
                            ? new DungeonEditorOperation.DeleteRoomRectangle(
                            toCellRef(room.start()),
                            toCellRef(room.end()))
                            : new DungeonEditorOperation.PaintRoomRectangle(
                            toCellRef(room.start()),
                            toCellRef(room.end()));
            case DungeonEditorPublishedEvent.ClusterBoundariesMutation boundaries ->
                    new DungeonEditorOperation.EditClusterBoundaries(
                            boundaries.clusterId(),
                            boundaries.edges().stream().map(DungeonEditorBinder::toEdgeRef).toList(),
                            DungeonBoundaryKind.valueOf(boundaries.boundaryKind()),
                            boundaries.deleteMode());
            case DungeonEditorPublishedEvent.SaveRoomNarrationMutation narration ->
                    new DungeonEditorOperation.SaveRoomNarration(
                            narration.roomId(),
                            narration.visualDescription(),
                            narration.exits().stream().map(DungeonEditorBinder::toPublishedExit).toList());
            case DungeonEditorPublishedEvent.MoveHandleMutation moveHandle ->
                    new DungeonEditorOperation.MoveEditorHandle(
                            toHandleRef(moveHandle.handleRef()),
                            moveHandle.deltaQ(),
                            moveHandle.deltaR(),
                            moveHandle.deltaLevel());
            case DungeonEditorPublishedEvent.MoveBoundaryStretchMutation stretch ->
                    new DungeonEditorOperation.MoveBoundaryStretch(
                            stretch.clusterId(),
                            stretch.sourceEdges().stream().map(DungeonEditorBinder::toEdgeRef).toList(),
                            stretch.deltaQ(),
                            stretch.deltaR(),
                            stretch.deltaLevel());
            case DungeonEditorPublishedEvent.NoneMutation ignored ->
                    throw new IllegalArgumentException("Cannot translate empty dungeon editor mutation.");
        };
    }

    private static DungeonCellRef toCellRef(DungeonEditorPublishedEvent.CellRef cell) {
        DungeonEditorPublishedEvent.CellRef safeCell = cell == null
                ? DungeonEditorPublishedEvent.CellRef.empty()
                : cell;
        return new DungeonCellRef(safeCell.q(), safeCell.r(), safeCell.level());
    }

    private static DungeonEdgeRef toEdgeRef(DungeonEditorPublishedEvent.EdgeRef edge) {
        DungeonEditorPublishedEvent.EdgeRef safeEdge = edge == null
                ? new DungeonEditorPublishedEvent.EdgeRef(
                DungeonEditorPublishedEvent.CellRef.empty(),
                DungeonEditorPublishedEvent.CellRef.empty())
                : edge;
        return new DungeonEdgeRef(toCellRef(safeEdge.from()), toCellRef(safeEdge.to()));
    }

    private static DungeonEditorHandleRef toHandleRef(DungeonEditorPublishedEvent.HandleRef handleRef) {
        DungeonEditorPublishedEvent.HandleRef safeHandle = handleRef == null
                ? DungeonEditorPublishedEvent.HandleRef.empty()
                : handleRef;
        return new DungeonEditorHandleRef(
                DungeonEditorHandleKind.valueOf(safeHandle.kind()),
                new DungeonTopologyElementRef(
                        DungeonTopologyElementKind.valueOf(safeHandle.topologyRefKind()),
                        safeHandle.topologyRefId()),
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.corridorId(),
                safeHandle.roomId(),
                safeHandle.index(),
                toCellRef(safeHandle.cell()),
                safeHandle.direction());
    }

    private static DungeonInspectorSnapshot.RoomExitNarration toPublishedExit(
            DungeonEditorPublishedEvent.RoomExitNarration exit
    ) {
        DungeonEditorPublishedEvent.RoomExitNarration safeExit = exit == null
                ? new DungeonEditorPublishedEvent.RoomExitNarration(
                "",
                DungeonEditorPublishedEvent.CellRef.empty(),
                "",
                "")
                : exit;
        return new DungeonInspectorSnapshot.RoomExitNarration(
                safeExit.label(),
                toCellRef(safeExit.cell()),
                safeExit.direction(),
                safeExit.description());
    }

    private static void syncMapControls(
            DungeonEditorContributionModel contributionModel,
            DungeonEditorControlsView controls
    ) {
        boolean hasMap = contributionModel.selectedMapKeyProperty().get() != null
                && !contributionModel.selectedMapKeyProperty().get().isBlank();
        boolean busy = contributionModel.busyProperty().get();
        controls.showMaps(
                contributionModel.mapsProperty().get().stream().map(DungeonEditorBinder::toControlMapItem).toList(),
                contributionModel.selectedMapKeyProperty().get(),
                busy,
                contributionModel.statusProperty().get());
        controls.showLevels(
                contributionModel.reachableLevelsProperty().get(),
                contributionModel.projectionLevelProperty().get(),
                busy,
                hasMap);
        controls.showOverlaySettings(toControlsOverlaySettings(contributionModel.overlaySettingsProperty().get()), busy);
    }

    private static void syncStateView(
            DungeonEditorContributionModel contributionModel,
            DungeonEditorStateView state
    ) {
        DungeonInspectorSnapshot inspector = contributionModel.inspectorProperty().get();
        state.showNarrationCards(
                inspector == null
                        ? List.of()
                        : inspector.roomNarrations().stream().map(DungeonEditorBinder::toStateCard).toList(),
                contributionModel.busyProperty().get(),
                contributionModel.statusProperty().get());
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

    private static String toControlsViewMode(DungeonMapContentModel.RenderState.ViewMode viewMode) {
        return viewMode == DungeonMapContentModel.RenderState.ViewMode.GRAPH
                ? DungeonEditorControlsView.VIEW_GRAPH
                : DungeonEditorControlsView.VIEW_GRID;
    }

    private static DungeonLevelOverlayControlsView.Settings toControlsOverlaySettings(
            DungeonMapContentModel.RenderState.LevelOverlaySettings settings
    ) {
        if (settings == null) {
            return new DungeonLevelOverlayControlsView.Settings(
                    DungeonLevelOverlayControlsView.Mode.OFF,
                    2,
                    0.35,
                    List.of());
        }
        return new DungeonLevelOverlayControlsView.Settings(
                toControlsOverlayMode(settings.mode()),
                settings.levelRange(),
                settings.opacity(),
                settings.selectedLevels());
    }

    private static DungeonLevelOverlayControlsView.Mode toControlsOverlayMode(
            DungeonMapContentModel.RenderState.OverlayMode overlayMode
    ) {
        if (overlayMode == DungeonMapContentModel.RenderState.OverlayMode.NEARBY) {
            return DungeonLevelOverlayControlsView.Mode.NEARBY;
        }
        if (overlayMode == DungeonMapContentModel.RenderState.OverlayMode.SELECTED) {
            return DungeonLevelOverlayControlsView.Mode.SELECTED;
        }
        return DungeonLevelOverlayControlsView.Mode.OFF;
    }

    private static DungeonEditorControlsView.MapItem toControlMapItem(
            DungeonEditorContributionModel.MapSelection selection
    ) {
        return new DungeonEditorControlsView.MapItem(
                selection.key(),
                selection.mapId() == null ? 0L : selection.mapId().value(),
                selection.mapName(),
                selection.revision());
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
