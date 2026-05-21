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

final class DungeonEditorIntentHandler {

    private static final String NAME_MISSING_ERROR = "Name fehlt.";
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
            consumeMapCanvas(event);
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

    private void consumeMapCanvas(DungeonMapViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (consumeLocalCameraInput(event)) {
            return;
        }
        if (event.input().scrolled()) {
            handleScroll(event);
            return;
        }
        if (secondaryOnly(event)) {
            lastHoverSample = null;
            return;
        }
        DungeonEditorTool selectedTool = presentationModel.currentInteractionState().currentSelectedTool();
        double sceneX = sceneX(event);
        double sceneY = sceneY(event);
        DungeonMapContentModel.PointerTarget pointerTarget = mapContentModel.resolvePointerTarget(sceneX, sceneY);
        if (suppressedRepeatedHover(event, selectedTool, pointerTarget)) {
            return;
        }
        applyToolWorkflow(event, pointerSample(event, pointerTarget), selectedTool);
    }

    private boolean consumeLocalCameraInput(DungeonMapViewInputEvent event) {
        if (event.input().mousePressed() && event.buttons().middleButtonDown()) {
            mapContentModel.beginMiddleDrag(event.position().canvasX(), event.position().canvasY());
            return true;
        }
        if (event.input().mouseDragged() && event.buttons().middleButtonDown()) {
            mapContentModel.panMiddleDragTo(event.position().canvasX(), event.position().canvasY());
            return true;
        }
        if (event.input().mouseReleased() && event.buttons().middleButtonDown()) {
            mapContentModel.endMiddleDrag();
            return true;
        }
        if (event.input().scrolled() && !event.modifiers().controlDown()) {
            mapContentModel.zoomForScroll(
                    event.position().canvasX(),
                    event.position().canvasY(),
                    event.scrollDeltaY());
            return true;
        }
        return event.buttons().middleButtonDown();
    }

    private static boolean secondaryOnly(DungeonMapViewInputEvent event) {
        return event.buttons().secondaryButtonDown()
                && !event.buttons().primaryButtonDown()
                && !event.buttons().middleButtonDown();
    }

    private void applyToolWorkflow(
            DungeonMapViewInputEvent event,
            DungeonEditorPointerSample pointerSample,
            DungeonEditorTool tool
    ) {
        switch (tool) {
            case ROOM_PAINT -> applyRoomPaint(event, pointerSample);
            case ROOM_DELETE -> applyRoomDelete(event, pointerSample);
            case WALL_CREATE -> applyWallCreate(event, pointerSample);
            case WALL_DELETE -> applyWallDelete(event, pointerSample);
            case DOOR_CREATE -> applyDoorCreate(event, pointerSample);
            case DOOR_DELETE -> applyDoorDelete(event, pointerSample);
            case CORRIDOR_CREATE -> applyCorridorCreate(event, pointerSample);
            case CORRIDOR_DELETE -> applyCorridorDelete(event, pointerSample);
            case SELECT -> applySelection(event, pointerSample);
            case STAIR_CREATE, STAIR_DELETE, TRANSITION_CREATE, TRANSITION_DELETE -> { }
        }
    }

    private void applySelection(
            DungeonMapViewInputEvent event,
            DungeonEditorPointerSample pointerSample
    ) {
        if (event.input().mousePressed()) {
            editor.pressSelection(new DungeonEditorSelectionCommand(pointerSample));
        } else if (event.input().mouseDragged()) {
            editor.dragSelection(new DungeonEditorSelectionCommand(pointerSample));
        } else if (event.input().mouseReleased()) {
            editor.releaseSelection(new DungeonEditorSelectionCommand(pointerSample));
        } else if (event.input().mouseMoved()) {
            editor.hoverSelection(new DungeonEditorSelectionCommand(pointerSample));
        }
    }

    private void applyRoomPaint(
            DungeonMapViewInputEvent event,
            DungeonEditorPointerSample pointerSample
    ) {
        if (event.input().mousePressed()) {
            editor.pressPaintRoom(new PaintDungeonEditorRoomCommand(pointerSample));
        } else if (event.input().mouseDragged()) {
            editor.dragPaintRoom(new PaintDungeonEditorRoomCommand(pointerSample));
        } else if (event.input().mouseReleased()) {
            editor.releasePaintRoom(new PaintDungeonEditorRoomCommand(pointerSample));
        }
    }

    private void applyRoomDelete(
            DungeonMapViewInputEvent event,
            DungeonEditorPointerSample pointerSample
    ) {
        if (event.input().mousePressed()) {
            editor.pressDeleteRoom(new DeleteDungeonEditorRoomCommand(pointerSample));
        } else if (event.input().mouseDragged()) {
            editor.dragDeleteRoom(new DeleteDungeonEditorRoomCommand(pointerSample));
        } else if (event.input().mouseReleased()) {
            editor.releaseDeleteRoom(new DeleteDungeonEditorRoomCommand(pointerSample));
        }
    }

    private void applyWallCreate(
            DungeonMapViewInputEvent event,
            DungeonEditorPointerSample pointerSample
    ) {
        if (event.input().mousePressed()) {
            editor.pressCreateWall(new CreateDungeonEditorWallCommand(pointerSample));
        } else if (event.input().mouseDragged()) {
            editor.dragCreateWall(new CreateDungeonEditorWallCommand(pointerSample));
        } else if (event.input().mouseMoved()) {
            editor.hoverCreateWall(new CreateDungeonEditorWallCommand(pointerSample));
        }
    }

    private void applyWallDelete(
            DungeonMapViewInputEvent event,
            DungeonEditorPointerSample pointerSample
    ) {
        if (event.input().mousePressed()) {
            editor.pressDeleteWall(new DeleteDungeonEditorWallCommand(pointerSample));
        } else if (event.input().mouseDragged()) {
            editor.dragDeleteWall(new DeleteDungeonEditorWallCommand(pointerSample));
        } else if (event.input().mouseMoved()) {
            editor.hoverDeleteWall(new DeleteDungeonEditorWallCommand(pointerSample));
        }
    }

    private void applyDoorCreate(
            DungeonMapViewInputEvent event,
            DungeonEditorPointerSample pointerSample
    ) {
        if (event.input().mousePressed()) {
            editor.pressCreateDoor(new CreateDungeonEditorDoorCommand(pointerSample));
        } else if (event.input().mouseDragged()) {
            editor.dragCreateDoor(new CreateDungeonEditorDoorCommand(pointerSample));
        } else if (event.input().mouseMoved()) {
            editor.hoverCreateDoor(new CreateDungeonEditorDoorCommand(pointerSample));
        } else if (event.input().mouseReleased()) {
            editor.releaseCreateDoor(new CreateDungeonEditorDoorCommand(pointerSample));
        }
    }

    private void applyDoorDelete(
            DungeonMapViewInputEvent event,
            DungeonEditorPointerSample pointerSample
    ) {
        if (event.input().mousePressed()) {
            editor.pressDeleteDoor(new DeleteDungeonEditorDoorCommand(pointerSample));
        } else if (event.input().mouseDragged()) {
            editor.dragDeleteDoor(new DeleteDungeonEditorDoorCommand(pointerSample));
        } else if (event.input().mouseMoved()) {
            editor.hoverDeleteDoor(new DeleteDungeonEditorDoorCommand(pointerSample));
        } else if (event.input().mouseReleased()) {
            editor.releaseDeleteDoor(new DeleteDungeonEditorDoorCommand(pointerSample));
        }
    }

    private void applyCorridorCreate(
            DungeonMapViewInputEvent event,
            DungeonEditorPointerSample pointerSample
    ) {
        if (event.input().mousePressed()) {
            editor.pressCreateCorridor(new CreateDungeonEditorCorridorCommand(pointerSample));
        } else if (event.input().mouseMoved()) {
            editor.hoverCreateCorridor(new CreateDungeonEditorCorridorCommand(pointerSample));
        }
    }

    private void applyCorridorDelete(
            DungeonMapViewInputEvent event,
            DungeonEditorPointerSample pointerSample
    ) {
        if (event.input().mousePressed()) {
            editor.pressDeleteCorridor(new DeleteDungeonEditorCorridorCommand(pointerSample));
        } else if (event.input().mouseMoved()) {
            editor.hoverDeleteCorridor(new DeleteDungeonEditorCorridorCommand(pointerSample));
        }
    }

    private void handleScroll(DungeonMapViewInputEvent event) {
        if (!event.modifiers().controlDown()) {
            return;
        }
        int levelDelta = normalizeLevelDelta(event.scrollDeltaY());
        if (levelDelta != NO_LEVEL_DELTA) {
            editor.scrollSelection(new ShiftDungeonEditorProjectionLevelCommand(levelDelta));
        }
    }

    private DungeonEditorPointerSample pointerSample(
            DungeonMapViewInputEvent event,
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
            DungeonMapViewInputEvent event,
            DungeonEditorTool selectedTool,
            DungeonMapContentModel.PointerTarget target
    ) {
        if (!event.input().mouseMoved()) {
            lastHoverSample = null;
            return false;
        }
        HoverSample nextSample = HoverSample.from(
                event,
                selectedTool,
                target,
                sceneX(event),
                sceneY(event));
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

    private double sceneX(DungeonMapViewInputEvent event) {
        return mapContentModel.currentViewport().screenToSceneX(event.position().canvasX());
    }

    private double sceneY(DungeonMapViewInputEvent event) {
        return mapContentModel.currentViewport().screenToSceneY(event.position().canvasY());
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
            editor.createMap(new DungeonMapCatalogCommand.CreateMapCommand(draftName));
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
            editor.renameMap(new DungeonMapCatalogCommand.RenameMapCommand(new DungeonMapId(mapIdValue), draftName));
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
                DungeonMapViewInputEvent event,
                DungeonEditorTool tool,
                DungeonMapContentModel.PointerTarget target,
                double sceneX,
                double sceneY
        ) {
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
