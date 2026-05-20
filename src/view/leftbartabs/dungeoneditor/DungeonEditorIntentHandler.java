package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonEditorApplicationService;
import src.domain.dungeon.published.DungeonAuthoredReadCommand;
import src.domain.dungeon.published.CreateDungeonEditorCorridorCommand;
import src.domain.dungeon.published.CreateDungeonEditorDoorCommand;
import src.domain.dungeon.published.CreateDungeonEditorWallCommand;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DeleteDungeonEditorCorridorCommand;
import src.domain.dungeon.published.DeleteDungeonEditorDoorCommand;
import src.domain.dungeon.published.DeleteDungeonEditorRoomCommand;
import src.domain.dungeon.published.DeleteDungeonEditorWallCommand;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorBoundaryTargetRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonEditorPointerSample;
import src.domain.dungeon.published.DungeonEditorPointerTarget;
import src.domain.dungeon.published.DungeonEditorSelectionCommand;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.PaintDungeonEditorRoomCommand;
import src.domain.dungeon.published.SaveDungeonEditorRoomNarrationCommand;
import src.domain.dungeon.published.SaveDungeonEditorRoomNarrationCommand.ExitNarration;
import src.domain.dungeon.published.SetDungeonEditorOverlayCommand;
import src.domain.dungeon.published.SetDungeonEditorToolCommand;
import src.domain.dungeon.published.SetDungeonEditorViewModeCommand;
import src.domain.dungeon.published.ShiftDungeonEditorProjectionLevelCommand;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapViewInputEvent;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasViewInputEvent;

final class DungeonEditorIntentHandler {

    private static final String NAME_MISSING_ERROR = "Name fehlt.";
    private static final double ZOOM_IN_FACTOR = 1.1;
    private static final double ZOOM_OUT_FACTOR = 1.0 / ZOOM_IN_FACTOR;
    private static final double ZERO_SCROLL_DELTA = 0.0;
    private static final long NO_MAP_ID = 0L;
    private static final int NO_LEVEL_DELTA = 0;
    private static final int LEVEL_UP_DELTA = 1;
    private static final int LEVEL_DOWN_DELTA = -1;
    private static final String TOOL_FAMILY_ROOM = "ROOM";
    private static final String TOOL_FAMILY_WALL = "WALL";
    private static final String TOOL_FAMILY_DOOR = "DOOR";
    private static final String TOOL_FAMILY_CORRIDOR = "CORRIDOR";
    private static final String TOOL_FAMILY_STAIR = "STAIR";
    private static final String TOOL_FAMILY_TRANSITION = "TRANSITION";

    private final DungeonEditorContributionModel presentationModel;
    private final DungeonEditorMapControlsContentModel mapControlsContentModel;
    private final DungeonEditorToolControlsContentModel toolControlsContentModel;
    private final DungeonEditorStateContentModel stateContentModel;
    private final DungeonMapContentModel mapContentModel;
    private final DungeonEditorApplicationService editor;
    private @Nullable HoverSample lastHoverSample;

    DungeonEditorIntentHandler(
            DungeonEditorContributionModel presentationModel,
            DungeonEditorMapControlsContentModel mapControlsContentModel,
            DungeonEditorToolControlsContentModel toolControlsContentModel,
            DungeonEditorStateContentModel stateContentModel,
            DungeonMapContentModel mapContentModel,
            DungeonEditorApplicationService editor
    ) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.mapControlsContentModel = Objects.requireNonNull(mapControlsContentModel, "mapControlsContentModel");
        this.toolControlsContentModel = Objects.requireNonNull(toolControlsContentModel, "toolControlsContentModel");
        this.stateContentModel = Objects.requireNonNull(stateContentModel, "stateContentModel");
        this.mapContentModel = Objects.requireNonNull(mapContentModel, "mapContentModel");
        this.editor = Objects.requireNonNull(editor, "editor");
    }

    void consume(DungeonMapViewInputEvent event) {
        if (event != null) {
            consumeMapCanvas(event.canvasEvent());
        }
    }

    void consume(DungeonEditorControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        DungeonEditorControlsViewInputEvent.MapSnapshot map = event.map();
        DungeonEditorControlsViewInputEvent.ProjectionSnapshot projection = event.projection();
        DungeonEditorControlsViewInputEvent.ToolSnapshot tool = event.tool();
        DungeonEditorControlsViewInputEvent.OverlaySnapshot overlay = event.overlay();
        if (map.selectedMapIdValue() > NO_MAP_ID) {
            handleMapSelection(map.selectedMapIdValue());
            return;
        }
        if (hasMapEditorInput(map)) {
            handleMapEditor(map);
            return;
        }
        if (projection.viewModeKey() != null) {
            handleViewMode(projection.viewModeKey());
            return;
        }
        if (hasToolInput(tool)) {
            handleToolInput(tool);
            return;
        }
        if (projection.levelShift() != 0) {
            editor.shiftProjectionLevel(new ShiftDungeonEditorProjectionLevelCommand(projection.levelShift()));
            return;
        }
        if (!overlay.modeKey().isBlank()) {
            handleOverlayInput(overlay);
        }
    }

    void consume(DungeonEditorStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        stateContentModel.updateNarrationDraft(event);
        if (!event.saveRequested()) {
            return;
        }
        SaveDungeonEditorRoomNarrationCommand command = toSaveRoomNarrationCommand(event);
        if (command != null) {
            stateContentModel.clearNarrationDraft(event.roomId());
            editor.saveRoomNarration(command);
        }
    }

    private void consumeMapCanvas(MapCanvasViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.interaction().isDrag() && event.buttons().middleButtonDown()) {
            mapContentModel.mapCanvasContentModel().panByPixels(event.dragDeltaX(), event.dragDeltaY());
            return;
        }
        if (event.interaction().isScroll()) {
            handleScroll(event);
            return;
        }
        if (event.buttons().middleButtonDown()) {
            return;
        }
        if (secondaryOnly(event)) {
            lastHoverSample = null;
            return;
        }
        DungeonEditorTool selectedTool = presentationModel.currentInteractionState().currentSelectedTool();
        DungeonMapContentModel.PointerTarget pointerTarget = mapContentModel.resolvePointerTarget(event);
        if (suppressedRepeatedHover(event, selectedTool, pointerTarget)) {
            return;
        }
        applyToolWorkflow(event, pointerSample(event, pointerTarget), selectedTool);
    }

    private static boolean secondaryOnly(MapCanvasViewInputEvent event) {
        return event.buttons().secondaryButtonDown()
                && !event.buttons().primaryButtonDown()
                && !event.buttons().middleButtonDown();
    }

    private void applyToolWorkflow(
            MapCanvasViewInputEvent event,
            DungeonEditorPointerSample pointerSample,
            DungeonEditorTool tool
    ) {
        switch (tool) {
            case ROOM_PAINT -> applyRoomPaint(event.interaction(), pointerSample);
            case ROOM_DELETE -> applyRoomDelete(event.interaction(), pointerSample);
            case WALL_CREATE -> applyWallCreate(event.interaction(), pointerSample);
            case WALL_DELETE -> applyWallDelete(event.interaction(), pointerSample);
            case DOOR_CREATE -> applyDoorCreate(event.interaction(), pointerSample);
            case DOOR_DELETE -> applyDoorDelete(event.interaction(), pointerSample);
            case CORRIDOR_CREATE -> applyCorridorCreate(event.interaction(), pointerSample);
            case CORRIDOR_DELETE -> applyCorridorDelete(event.interaction(), pointerSample);
            case SELECT -> applySelection(event.interaction(), pointerSample);
            case STAIR_CREATE, STAIR_DELETE, TRANSITION_CREATE, TRANSITION_DELETE -> { }
        }
    }

    private void applySelection(
            MapCanvasViewInputEvent.Interaction interaction,
            DungeonEditorPointerSample pointerSample
    ) {
        switch (safeInteraction(interaction)) {
            case PRESS -> editor.pressSelection(new DungeonEditorSelectionCommand(pointerSample));
            case DRAG -> editor.dragSelection(new DungeonEditorSelectionCommand(pointerSample));
            case RELEASE -> editor.releaseSelection(new DungeonEditorSelectionCommand(pointerSample));
            case MOVE -> editor.hoverSelection(new DungeonEditorSelectionCommand(pointerSample));
            case SCROLL -> { }
        }
    }

    private void applyRoomPaint(
            MapCanvasViewInputEvent.Interaction interaction,
            DungeonEditorPointerSample pointerSample
    ) {
        switch (safeInteraction(interaction)) {
            case PRESS -> editor.pressPaintRoom(new PaintDungeonEditorRoomCommand(pointerSample));
            case DRAG -> editor.dragPaintRoom(new PaintDungeonEditorRoomCommand(pointerSample));
            case RELEASE -> editor.releasePaintRoom(new PaintDungeonEditorRoomCommand(pointerSample));
            case MOVE, SCROLL -> { }
        }
    }

    private void applyRoomDelete(
            MapCanvasViewInputEvent.Interaction interaction,
            DungeonEditorPointerSample pointerSample
    ) {
        switch (safeInteraction(interaction)) {
            case PRESS -> editor.pressDeleteRoom(new DeleteDungeonEditorRoomCommand(pointerSample));
            case DRAG -> editor.dragDeleteRoom(new DeleteDungeonEditorRoomCommand(pointerSample));
            case RELEASE -> editor.releaseDeleteRoom(new DeleteDungeonEditorRoomCommand(pointerSample));
            case MOVE, SCROLL -> { }
        }
    }

    private void applyWallCreate(
            MapCanvasViewInputEvent.Interaction interaction,
            DungeonEditorPointerSample pointerSample
    ) {
        switch (safeInteraction(interaction)) {
            case PRESS -> editor.pressCreateWall(new CreateDungeonEditorWallCommand(pointerSample));
            case DRAG -> editor.dragCreateWall(new CreateDungeonEditorWallCommand(pointerSample));
            case MOVE -> editor.hoverCreateWall(new CreateDungeonEditorWallCommand(pointerSample));
            case RELEASE, SCROLL -> { }
        }
    }

    private void applyWallDelete(
            MapCanvasViewInputEvent.Interaction interaction,
            DungeonEditorPointerSample pointerSample
    ) {
        switch (safeInteraction(interaction)) {
            case PRESS -> editor.pressDeleteWall(new DeleteDungeonEditorWallCommand(pointerSample));
            case DRAG -> editor.dragDeleteWall(new DeleteDungeonEditorWallCommand(pointerSample));
            case MOVE -> editor.hoverDeleteWall(new DeleteDungeonEditorWallCommand(pointerSample));
            case RELEASE, SCROLL -> { }
        }
    }

    private void applyDoorCreate(
            MapCanvasViewInputEvent.Interaction interaction,
            DungeonEditorPointerSample pointerSample
    ) {
        switch (safeInteraction(interaction)) {
            case PRESS -> editor.pressCreateDoor(new CreateDungeonEditorDoorCommand(pointerSample));
            case DRAG -> editor.dragCreateDoor(new CreateDungeonEditorDoorCommand(pointerSample));
            case MOVE -> editor.hoverCreateDoor(new CreateDungeonEditorDoorCommand(pointerSample));
            case RELEASE -> editor.releaseCreateDoor(new CreateDungeonEditorDoorCommand(pointerSample));
            case SCROLL -> { }
        }
    }

    private void applyDoorDelete(
            MapCanvasViewInputEvent.Interaction interaction,
            DungeonEditorPointerSample pointerSample
    ) {
        switch (safeInteraction(interaction)) {
            case PRESS -> editor.pressDeleteDoor(new DeleteDungeonEditorDoorCommand(pointerSample));
            case DRAG -> editor.dragDeleteDoor(new DeleteDungeonEditorDoorCommand(pointerSample));
            case MOVE -> editor.hoverDeleteDoor(new DeleteDungeonEditorDoorCommand(pointerSample));
            case RELEASE -> editor.releaseDeleteDoor(new DeleteDungeonEditorDoorCommand(pointerSample));
            case SCROLL -> { }
        }
    }

    private void applyCorridorCreate(
            MapCanvasViewInputEvent.Interaction interaction,
            DungeonEditorPointerSample pointerSample
    ) {
        switch (safeInteraction(interaction)) {
            case PRESS -> editor.pressCreateCorridor(new CreateDungeonEditorCorridorCommand(pointerSample));
            case MOVE -> editor.hoverCreateCorridor(new CreateDungeonEditorCorridorCommand(pointerSample));
            case DRAG, RELEASE, SCROLL -> { }
        }
    }

    private void applyCorridorDelete(
            MapCanvasViewInputEvent.Interaction interaction,
            DungeonEditorPointerSample pointerSample
    ) {
        switch (safeInteraction(interaction)) {
            case PRESS -> editor.pressDeleteCorridor(new DeleteDungeonEditorCorridorCommand(pointerSample));
            case MOVE -> editor.hoverDeleteCorridor(new DeleteDungeonEditorCorridorCommand(pointerSample));
            case DRAG, RELEASE, SCROLL -> { }
        }
    }

    private void handleScroll(MapCanvasViewInputEvent event) {
        if (!event.modifiers().controlDown()) {
            zoomForScroll(event);
            return;
        }
        int levelDelta = normalizeLevelDelta(event.scrollDeltaY());
        if (levelDelta != NO_LEVEL_DELTA) {
            editor.scrollSelection(new ShiftDungeonEditorProjectionLevelCommand(levelDelta));
        }
    }

    private void zoomForScroll(MapCanvasViewInputEvent event) {
        if (event.scrollDeltaY() > ZERO_SCROLL_DELTA) {
            mapContentModel.mapCanvasContentModel().zoomAround(
                    event.position().canvasX(),
                    event.position().canvasY(),
                    ZOOM_IN_FACTOR);
        } else if (event.scrollDeltaY() < ZERO_SCROLL_DELTA) {
            mapContentModel.mapCanvasContentModel().zoomAround(
                    event.position().canvasX(),
                    event.position().canvasY(),
                    ZOOM_OUT_FACTOR);
        }
    }

    private DungeonEditorPointerSample pointerSample(
            MapCanvasViewInputEvent event,
            DungeonMapContentModel.PointerTarget target
    ) {
        return new DungeonEditorPointerSample(
                event.position().canvasX(),
                event.position().canvasY(),
                event.buttons().primaryButtonDown(),
                event.buttons().secondaryButtonDown(),
                toPublishedPointerTarget(target));
    }

    private boolean suppressedRepeatedHover(
            MapCanvasViewInputEvent event,
            DungeonEditorTool selectedTool,
            DungeonMapContentModel.PointerTarget target
    ) {
        if (safeInteraction(event.interaction()) != MapCanvasViewInputEvent.Interaction.MOVE) {
            lastHoverSample = null;
            return false;
        }
        HoverSample nextSample = HoverSample.from(event, selectedTool, target);
        if (nextSample.equals(lastHoverSample)) {
            return true;
        }
        lastHoverSample = nextSample;
        return false;
    }

    private static DungeonEditorPointerTarget toPublishedPointerTarget(DungeonMapContentModel.PointerTarget target) {
        DungeonMapContentModel.PointerTarget safeTarget = target == null
                ? DungeonMapContentModel.PointerTarget.empty()
                : target;
        return switch (safeTarget.targetKind()) {
            case EMPTY -> DungeonEditorPointerTarget.empty();
            case CELL -> DungeonEditorPointerTarget.cell(
                    topologyElementKind(safeTarget.elementKind()),
                    safeTarget.ownerId(),
                    safeTarget.clusterId(),
                    topologyRef(safeTarget.topologyKind(), safeTarget.topologyId()));
            case LABEL -> DungeonEditorPointerTarget.label(
                    safeTarget.ownerId(),
                    safeTarget.clusterId(),
                    topologyRef(safeTarget.topologyKind(), safeTarget.topologyId()));
            case GRAPH_NODE -> DungeonEditorPointerTarget.graphNode(
                    safeTarget.ownerId(),
                    safeTarget.clusterId(),
                    topologyRef(safeTarget.topologyKind(), safeTarget.topologyId()));
            case HANDLE -> DungeonEditorPointerTarget.handle(handleRef(safeTarget.handleRef()));
            case BOUNDARY -> DungeonEditorPointerTarget.boundary(boundaryRef(safeTarget.boundaryRef()));
        };
    }

    private static DungeonTopologyElementRef topologyRef(String kind, long id) {
        return new DungeonTopologyElementRef(topologyElementKind(kind), id);
    }

    private static DungeonCellRef cellRef(double q, double r, int level) {
        return new DungeonCellRef(
                (int) Math.round(q),
                (int) Math.round(r),
                level);
    }

    private static DungeonEditorHandleRef handleRef(DungeonMapContentModel.HandleTarget handle) {
        DungeonMapContentModel.HandleTarget safeHandle = handle == null
                ? DungeonMapContentModel.HandleTarget.empty()
                : handle;
        return new DungeonEditorHandleRef(
                handleKind(safeHandle.kind()),
                topologyRef(safeHandle.topologyKind(), safeHandle.topologyId()),
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.corridorId(),
                safeHandle.roomId(),
                safeHandle.orderIndex(),
                cellRef(safeHandle.q(), safeHandle.r(), safeHandle.level()),
                safeHandle.direction());
    }

    private static DungeonEditorBoundaryTargetRef boundaryRef(DungeonMapContentModel.BoundaryTarget boundary) {
        DungeonMapContentModel.BoundaryTarget safeBoundary = boundary == null
                ? DungeonMapContentModel.BoundaryTarget.empty()
                : boundary;
        return new DungeonEditorBoundaryTargetRef(
                boundaryKind(safeBoundary.kind()),
                safeBoundary.key(),
                safeBoundary.ownerId(),
                topologyRef(safeBoundary.topologyKind(), safeBoundary.topologyId()),
                cellRef(safeBoundary.startQ(), safeBoundary.startR(), safeBoundary.startLevel()),
                cellRef(safeBoundary.endQ(), safeBoundary.endR(), safeBoundary.endLevel()));
    }

    private static DungeonBoundaryKind boundaryKind(String value) {
        return "DOOR".equals(value) ? DungeonBoundaryKind.DOOR : DungeonBoundaryKind.WALL;
    }

    private static DungeonEditorHandleKind handleKind(String value) {
        try {
            return DungeonEditorHandleKind.valueOf(normalizedEnumName(value));
        } catch (IllegalArgumentException ignored) {
            return DungeonEditorHandleKind.CLUSTER_LABEL;
        }
    }

    private static DungeonTopologyElementKind topologyElementKind(String value) {
        try {
            return DungeonTopologyElementKind.valueOf(normalizedEnumName(value));
        } catch (IllegalArgumentException ignored) {
            return DungeonTopologyElementKind.EMPTY;
        }
    }

    private static String normalizedEnumName(String value) {
        return value == null ? "" : value.trim().toUpperCase(java.util.Locale.ROOT).replace('-', '_');
    }

    private static int normalizeLevelDelta(double scrollDeltaY) {
        if (scrollDeltaY > ZERO_SCROLL_DELTA) {
            return LEVEL_UP_DELTA;
        }
        if (scrollDeltaY < ZERO_SCROLL_DELTA) {
            return LEVEL_DOWN_DELTA;
        }
        return NO_LEVEL_DELTA;
    }

    private static MapCanvasViewInputEvent.Interaction safeInteraction(MapCanvasViewInputEvent.Interaction interaction) {
        return interaction == null
                ? MapCanvasViewInputEvent.Interaction.MOVE
                : interaction;
    }

    private void handleMapSelection(long selectedMapIdValue) {
        DungeonEditorContributionModel.InteractionState interactionState = presentationModel.currentInteractionState();
        if (selectedMapIdValue > NO_MAP_ID
                && selectedMapIdValue != interactionState.currentSelectedMapIdValue()) {
            editor.selectMap(new DungeonAuthoredReadCommand.MapSelection(new DungeonMapId(selectedMapIdValue)));
        }
    }

    private void handleMapEditor(DungeonEditorControlsViewInputEvent.MapSnapshot map) {
        mapControlsContentModel.updateMapEditorDraft(map.editorDraftName());
        DungeonEditorContributionModel.InteractionState interactionState = presentationModel.currentInteractionState();
        if (map.dismissControlActivated()) {
            mapControlsContentModel.closeMapEditor();
            return;
        }
        if (map.createControlActivated()) {
            mapControlsContentModel.openCreateMapEditor();
            return;
        }
        if (map.renameControlActivated()) {
            mapControlsContentModel.openSelectedMapEditor(
                    DungeonEditorMapControlsContentModel.MapEditorMode.RENAME,
                    interactionState.currentSelectedMapIdValue());
            return;
        }
        if (map.deleteControlActivated()) {
            mapControlsContentModel.openSelectedMapEditor(
                    DungeonEditorMapControlsContentModel.MapEditorMode.DELETE,
                    interactionState.currentSelectedMapIdValue());
            return;
        }
        if (map.confirmDeleteControlActivated()) {
            handleMapDelete();
            return;
        }
        if (map.submitControlActivated()) {
            handleMapEditorSubmit();
        }
    }

    private void handleMapEditorSubmit() {
        DungeonEditorMapControlsContentModel.MapEditorUiState mapEditorUiState =
                mapControlsContentModel.currentMapEditorUiState();
        String draftName = mapEditorUiState.draftName().strip();
        if (draftName.isBlank()) {
            mapControlsContentModel.showMapEditorValidationError(NAME_MISSING_ERROR);
            return;
        }
        if (mapEditorUiState.isCreateMode()) {
            mapControlsContentModel.closeMapEditor();
            editor.createMap(new DungeonMapCatalogCommand.CreateMap(draftName));
            return;
        }
        if (mapEditorUiState.isRenameMode()) {
            submitRename(mapEditorUiState, draftName);
        }
    }

    private void submitRename(DungeonEditorMapControlsContentModel.MapEditorUiState mapEditorUiState, String draftName) {
        long mapIdValue = mapEditorUiState.mapIdValue();
        if (mapIdValue > NO_MAP_ID) {
            mapControlsContentModel.closeMapEditor();
            editor.renameMap(new DungeonMapCatalogCommand.RenameMap(new DungeonMapId(mapIdValue), draftName));
        }
    }

    private void handleMapDelete() {
        DungeonEditorMapControlsContentModel.MapEditorUiState mapEditorUiState =
                mapControlsContentModel.currentMapEditorUiState();
        if (!mapEditorUiState.isDeleteMode()) {
            return;
        }
        long mapIdValue = mapEditorUiState.mapIdValue();
        if (mapIdValue > NO_MAP_ID) {
            mapControlsContentModel.closeMapEditor();
            editor.deleteMap(new DeleteDungeonMapCommand(new DungeonMapId(mapIdValue)));
        }
    }

    private void handleViewMode(@Nullable String viewModeKey) {
        if (viewModeKey == null || viewModeKey.isBlank()) {
            return;
        }
        String normalizedViewModeKey = ToolCatalog.normalizeViewModeKey(viewModeKey);
        String selectedViewMode = presentationModel.currentInteractionState().currentViewModeKey();
        if (ToolCatalog.GRAPH_VIEW_LABEL.equals(normalizedViewModeKey)) {
            if (!ToolCatalog.GRAPH_VIEW_LABEL.equals(selectedViewMode)) {
                editor.setViewMode(new SetDungeonEditorViewModeCommand(
                        ToolCatalog.toPublishedViewMode(normalizedViewModeKey)));
            }
            return;
        }
        if (!ToolCatalog.GRID_VIEW_LABEL.equals(selectedViewMode)) {
            editor.setViewMode(new SetDungeonEditorViewModeCommand(
                    ToolCatalog.toPublishedViewMode(ToolCatalog.GRID_VIEW_LABEL)));
        }
    }

    private void handleToolInput(DungeonEditorControlsViewInputEvent.ToolSnapshot tool) {
        if (tool.dismissControlActivated()) {
            toolControlsContentModel.showToolFamily(null);
            return;
        }
        DungeonEditorToolControlsContentModel.ToolFamily requestedFamily = requestedToolFamily(tool);
        if (requestedFamily != null) {
            toolControlsContentModel.showToolFamily(requestedFamily);
        } else {
            toolControlsContentModel.showToolFamily(null);
        }
        DungeonEditorContributionModel.InteractionState interactionState = presentationModel.currentInteractionState();
        DungeonEditorTool selectedTool = ToolCatalog.toPublishedToolKey(tool.selectedToolKey());
        if (tool.selectedToolKey() != null && selectedTool != interactionState.currentSelectedTool()) {
            editor.setTool(new SetDungeonEditorToolCommand(selectedTool));
        }
    }

    private void handleOverlayInput(DungeonEditorControlsViewInputEvent.OverlaySnapshot overlay) {
        DungeonEditorContributionModel.OverlayProjection currentOverlay =
                presentationModel.currentInteractionState().currentOverlayProjection();
        List<Integer> selectedLevels = parseLevels(overlay.selectedLevelsText());
        if (currentOverlay.modeKey().equals(overlay.modeKey())
                && currentOverlay.levelRange() == overlay.levelRange()
                && Double.compare(currentOverlay.opacity(), overlay.opacity()) == 0
                && parseLevels(currentOverlay.selectedLevelsText()).equals(selectedLevels)) {
            return;
        }
        editor.setOverlay(new SetDungeonEditorOverlayCommand(new DungeonOverlaySettings(
                        overlay.modeKey(),
                        overlay.levelRange(),
                        overlay.opacity(),
                        selectedLevels)));
    }

    private static boolean hasMapEditorInput(DungeonEditorControlsViewInputEvent.MapSnapshot map) {
        return map.editorInputObserved()
                || map.createControlActivated()
                || map.renameControlActivated()
                || map.deleteControlActivated()
                || map.dismissControlActivated()
                || map.submitControlActivated()
                || map.confirmDeleteControlActivated();
    }

    private static boolean hasToolInput(DungeonEditorControlsViewInputEvent.ToolSnapshot tool) {
        return tool.requestedFamilyKey() != null
                || tool.selectedToolKey() != null
                || tool.dismissControlActivated();
    }

    private static DungeonEditorToolControlsContentModel.ToolFamily requestedToolFamily(
            DungeonEditorControlsViewInputEvent.ToolSnapshot tool
    ) {
        String familyKey = tool.requestedFamilyKey();
        if (familyKey == null) {
            return null;
        }
        return switch (familyKey.trim().toUpperCase(Locale.ROOT)) {
            case TOOL_FAMILY_ROOM -> DungeonEditorToolControlsContentModel.ToolFamily.ROOM;
            case TOOL_FAMILY_WALL -> DungeonEditorToolControlsContentModel.ToolFamily.WALL;
            case TOOL_FAMILY_DOOR -> DungeonEditorToolControlsContentModel.ToolFamily.DOOR;
            case TOOL_FAMILY_CORRIDOR -> DungeonEditorToolControlsContentModel.ToolFamily.CORRIDOR;
            case TOOL_FAMILY_STAIR -> DungeonEditorToolControlsContentModel.ToolFamily.STAIR;
            case TOOL_FAMILY_TRANSITION -> DungeonEditorToolControlsContentModel.ToolFamily.TRANSITION;
            default -> null;
        };
    }

    private @Nullable SaveDungeonEditorRoomNarrationCommand toSaveRoomNarrationCommand(
            DungeonEditorStateViewInputEvent event
    ) {
        DungeonEditorStateContentModel.RoomNarrationCardProjection card =
                stateContentModel.currentNarrationCard(event.roomId());
        if (card == null) {
            return null;
        }
        List<ExitNarration> exits = stateContentModel.currentExitsWithDraftDescriptions(card).stream()
                .map(exit -> new ExitNarration(
                        exit.label(),
                        exit.q(),
                        exit.r(),
                        exit.level(),
                        exit.direction(),
                        exit.description()))
                .toList();
        return new SaveDungeonEditorRoomNarrationCommand(
                card.roomId(),
                stateContentModel.currentVisualDescription(card),
                exits);
    }

    private static List<Integer> parseLevels(@Nullable String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        try {
            return java.util.Arrays.stream(raw.split(","))
                    .map(String::trim)
                    .filter(part -> !part.isBlank())
                    .map(Integer::parseInt)
                    .sorted()
                    .distinct()
                    .toList();
        } catch (NumberFormatException exception) {
            return List.of();
        }
    }

    private record HoverSample(
            DungeonEditorTool tool,
            int cellQ,
            int cellR,
            boolean vertexPresent,
            int vertexQ,
            int vertexR,
            DungeonMapContentModel.PointerTarget target
    ) {
        private static final double VERTEX_SNAP_DISTANCE = 0.22;

        private static HoverSample from(
                MapCanvasViewInputEvent event,
                DungeonEditorTool tool,
                DungeonMapContentModel.PointerTarget target
        ) {
            double sceneX = event.position().sceneX();
            double sceneY = event.position().sceneY();
            int vertexQ = (int) Math.round(sceneX);
            int vertexR = (int) Math.round(sceneY);
            boolean vertexPresent = Math.hypot(sceneX - vertexQ, sceneY - vertexR) <= VERTEX_SNAP_DISTANCE;
            return new HoverSample(
                    tool == null ? DungeonEditorTool.SELECT : tool,
                    (int) Math.floor(sceneX),
                    (int) Math.floor(sceneY),
                    vertexPresent,
                    vertexQ,
                    vertexR,
                    target == null ? DungeonMapContentModel.PointerTarget.empty() : target);
        }
    }
}
