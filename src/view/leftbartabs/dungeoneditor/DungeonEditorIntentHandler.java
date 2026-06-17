package src.view.leftbartabs.dungeoneditor;

import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonEditorLabelNameApplicationService;
import src.domain.dungeon.DungeonEditorMapApplicationService;
import src.domain.dungeon.DungeonEditorNarrationApplicationService;
import src.domain.dungeon.DungeonEditorPointerApplicationService;
import src.domain.dungeon.DungeonEditorProjectionApplicationService;
import src.domain.dungeon.DungeonEditorStairApplicationService;
import src.domain.dungeon.DungeonEditorTransitionApplicationService;
import src.domain.dungeon.published.ApplyDungeonEditorPointerCommand;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorBoundaryTargetRef;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorPointerSample;
import src.domain.dungeon.published.DungeonEditorPointerTarget;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.MoveDungeonEditorHandleCommand;
import src.domain.dungeon.published.SaveDungeonEditorLabelNameCommand;
import src.domain.dungeon.published.SaveDungeonEditorRoomNarrationCommand;
import src.domain.dungeon.published.SaveDungeonEditorStairGeometryCommand;
import src.domain.dungeon.published.SaveDungeonEditorTransitionDescriptionCommand;
import src.domain.dungeon.published.SaveDungeonEditorTransitionLinkCommand;
import src.domain.dungeon.published.SelectDungeonEditorMapCommand;
import src.domain.dungeon.published.SetDungeonEditorOverlayCommand;
import src.domain.dungeon.published.SetDungeonEditorToolCommand;
import src.domain.dungeon.published.SetDungeonEditorViewModeCommand;
import src.domain.dungeon.published.ShiftDungeonEditorProjectionLevelCommand;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsViewInputEvent;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapViewInputEvent;

final class DungeonEditorIntentHandler {
    private static final Map<DungeonEditorTool, DungeonEditorTool> DELETE_TOOLS = deleteTools();
    private static final long NO_TRANSITION_ID = 0L;

    private final DungeonEditorContributionModel presentationModel;
    private final DungeonEditorControlsContentModel controlsContentModel;
    private final CatalogCrudControlsContentModel catalogContentModel;
    private final DungeonEditorStateContentModel stateContentModel;
    private final DungeonMapContentModel mapContentModel;
    private final DungeonEditorMapApplicationService mapEditor;
    private final DungeonEditorProjectionApplicationService projectionEditor;
    private final DungeonEditorPointerApplicationService pointerEditor;
    private final DungeonEditorNarrationApplicationService narrationEditor;
    private final DungeonEditorLabelNameApplicationService labelNameEditor;
    private final DungeonEditorTransitionApplicationService transitionEditor;
    private final DungeonEditorStairApplicationService stairEditor;
    private Optional<HoverSample> lastHoverSample = Optional.empty();
    private double lastCameraDragCanvasX;
    private double lastCameraDragCanvasY;
    private boolean cameraDragActive;
    private boolean inlineEditOutsidePressActive;

    DungeonEditorIntentHandler(
            DungeonEditorContributionModel presentationModel,
            DungeonEditorControlsContentModel controlsContentModel,
            CatalogCrudControlsContentModel catalogContentModel,
            DungeonEditorStateContentModel stateContentModel,
            DungeonMapContentModel mapContentModel,
            ApplicationServices applicationServices
    ) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.controlsContentModel = Objects.requireNonNull(controlsContentModel, "controlsContentModel");
        this.catalogContentModel = Objects.requireNonNull(catalogContentModel, "catalogContentModel");
        this.stateContentModel = Objects.requireNonNull(stateContentModel, "stateContentModel");
        this.mapContentModel = Objects.requireNonNull(mapContentModel, "mapContentModel");
        ApplicationServices safeApplicationServices = Objects.requireNonNull(applicationServices, "applicationServices");
        this.mapEditor = safeApplicationServices.mapEditor();
        this.projectionEditor = safeApplicationServices.projectionEditor();
        this.pointerEditor = safeApplicationServices.pointerEditor();
        this.narrationEditor = safeApplicationServices.narrationEditor();
        this.labelNameEditor = safeApplicationServices.labelNameEditor();
        this.transitionEditor = safeApplicationServices.transitionEditor();
        this.stairEditor = safeApplicationServices.stairEditor();
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
        long selectedMapIdValue = map.selectedMapIdValue();
        long noSelectedMapId = 0L;
        if (map.reloadControlActivated()) {
            reloadSelectedMap(selectedMapIdValue);
            return;
        }
        if (selectedMapIdValue > noSelectedMapId) {
            handleMapSelection(selectedMapIdValue);
            return;
        }
        if (hasMapEditorInput(map)) {
            handleMapEditor(map);
            return;
        }
        if (!projection.viewModeKey().isBlank()) {
            handleViewMode(projection.viewModeKey());
            return;
        }
        if (hasToolInput(tool)) {
            handleToolInput(tool);
            return;
        }
        int levelShift = projection.levelShift();
        if (levelShift != 0) {
            projectionEditor.shiftProjectionLevel(new ShiftDungeonEditorProjectionLevelCommand(levelShift));
            return;
        }
        if (!overlay.modeKey().isBlank()) {
            handleOverlayInput(overlay);
        }
    }

    void consume(CatalogCrudControlsViewInputEvent event) {
        if (event == null || consumeCatalogSelection(event) || consumeCatalogSubmit(event)) {
            return;
        }
        consumeCatalogEditor(event);
    }

    private boolean consumeCatalogSelection(CatalogCrudControlsViewInputEvent event) {
        if (!event.selectedItemId().isBlank()) {
            catalogContentModel.selectItem(event.selectedItemId());
            return true;
        }
        if (!event.openItemId().isBlank()) {
            catalogContentModel.selectItem(event.openItemId());
            handleMapSelection(parseLongOrZero(event.openItemId()));
            return true;
        }
        if (!event.reloadItemId().isBlank()) {
            reloadSelectedMap(parseLongOrZero(event.reloadItemId()));
            return true;
        }
        return false;
    }

    private boolean consumeCatalogSubmit(CatalogCrudControlsViewInputEvent event) {
        if (!event.createDraftName().isBlank()) {
            catalogContentModel.closeOperation();
            createMap(event.createDraftName());
            return true;
        }
        if (!event.renameItemId().isBlank() && !event.renameDraftName().isBlank()) {
            catalogContentModel.closeOperation();
            renameMap(parseLongOrZero(event.renameItemId()), event.renameDraftName());
            return true;
        }
        if (!event.deleteConfirmItemId().isBlank()) {
            catalogContentModel.closeOperation();
            deleteMap(parseLongOrZero(event.deleteConfirmItemId()));
            return true;
        }
        return false;
    }

    private void consumeCatalogEditor(CatalogCrudControlsViewInputEvent event) {
        if (event.createEditorOpened()) {
            catalogContentModel.openCreate();
            controlsContentModel.openCreateMapEditor();
            return;
        }
        if (!event.renameEditorItemId().isBlank()) {
            catalogContentModel.openRename(event.renameEditorItemId());
            controlsContentModel.openSelectedMapEditor(
                    DungeonEditorControlsContentModel.MapEditorMode.RENAME,
                    parseLongOrZero(event.renameEditorItemId()));
            return;
        }
        if (!event.deleteRequestItemId().isBlank()) {
            catalogContentModel.openDelete(event.deleteRequestItemId());
            controlsContentModel.openSelectedMapEditor(
                    DungeonEditorControlsContentModel.MapEditorMode.DELETE,
                    parseLongOrZero(event.deleteRequestItemId()));
            return;
        }
        if (event.dismissed()) {
            catalogContentModel.closeOperation();
            controlsContentModel.closeMapEditor();
        }
    }

    void consume(DungeonEditorStateViewInputEvent event) {
        if (event == null) {
            return;
        }
        consumeLabelNameWhenPresent(event);
        consumeNarrationWhenPresent(event);
        consumeCorridorPointWhenPresent(event);
        consumeTransitionDestinationWhenPresent(event);
        consumeTransitionDescriptionWhenPresent(event);
        consumeStairGeometryWhenPresent(event);
    }

    private void consumeNarrationWhenPresent(DungeonEditorStateViewInputEvent event) {
        if (event.roomId() > 0L || event.narrationSaveRequested()) {
            consumeNarrationInput(event);
        }
    }

    private void consumeLabelNameWhenPresent(DungeonEditorStateViewInputEvent event) {
        if (event.labelNameInputObserved() || event.labelNameSaveRequested()) {
            consumeLabelNameInput(event);
        }
    }

    private void consumeCorridorPointWhenPresent(DungeonEditorStateViewInputEvent event) {
        if (event.corridorPointInputObserved() || event.corridorPointSubmitRequested()) {
            consumeCorridorPointInput(event);
        }
    }

    private void consumeTransitionDescriptionWhenPresent(DungeonEditorStateViewInputEvent event) {
        if (event.transitionDescriptionInputObserved() || event.transitionDescriptionSaveRequested()) {
            consumeTransitionDescriptionInput(event);
        }
    }

    private void consumeTransitionDestinationWhenPresent(DungeonEditorStateViewInputEvent event) {
        if (event.transitionDestinationInputObserved()) {
            stateContentModel.updateTransitionDestinationDraft(
                    event.transitionDestinationType(),
                    event.transitionDestinationMapId(),
                    event.transitionDestinationTileId(),
                    event.transitionDestinationTransitionId(),
                    event.transitionDestinationBidirectional());
            if (event.transitionDestinationSaveRequested()) {
                consumeTransitionLinkSave(event);
            }
        }
    }

    private void consumeTransitionLinkSave(DungeonEditorStateViewInputEvent event) {
        long sourceTransitionId = selectedTransitionId();
        if (sourceTransitionId <= NO_TRANSITION_ID) {
            return;
        }
        transitionEditor.saveTransitionLink(new SaveDungeonEditorTransitionLinkCommand(
                sourceTransitionId,
                parseLongOrZero(event.transitionDestinationMapId()),
                parseLongOrZero(event.transitionDestinationTransitionId()),
                event.transitionDestinationBidirectional()));
    }

    private void consumeStairGeometryWhenPresent(DungeonEditorStateViewInputEvent event) {
        if (event.stairGeometryInputObserved() || event.stairGeometrySaveRequested()) {
            consumeStairGeometryInput(event);
        }
    }

    private void consumeNarrationInput(DungeonEditorStateViewInputEvent event) {
        stateContentModel.updateNarrationDraft(
                event.roomId(),
                event.visualDescription(),
                event.exitDescriptions());
        if (!event.narrationSaveRequested()) {
            return;
        }
        SaveDungeonEditorRoomNarrationCommand command = toSaveRoomNarrationCommand(event);
        if (command != null) {
            stateContentModel.clearNarrationDraft(event.roomId());
            narrationEditor.saveRoomNarration(command);
        }
    }

    private void consumeLabelNameInput(DungeonEditorStateViewInputEvent event) {
        stateContentModel.updateNameDraft(
                event.nameTargetKind(),
                event.nameTargetId(),
                event.labelName());
        if (!event.labelNameSaveRequested() || event.nameTargetId() <= 0L || event.labelName().isBlank()) {
            return;
        }
        stateContentModel.clearNameDraft(event.nameTargetKind(), event.nameTargetId());
        labelNameEditor.saveLabelName(new SaveDungeonEditorLabelNameCommand(
                event.nameTargetKind(),
                event.nameTargetId(),
                event.labelName()));
    }

    private void consumeCorridorPointInput(DungeonEditorStateViewInputEvent event) {
        stateContentModel.updateCorridorPointDraft(
                event.corridorPointQ(),
                event.corridorPointR());
        if (event.corridorPointSubmitRequested()) {
            submitCorridorPointMove(event);
        }
    }

    private void consumeTransitionDescriptionInput(
            DungeonEditorStateViewInputEvent event
    ) {
        stateContentModel.updateTransitionDescriptionDraft(
                event.transitionId(),
                event.transitionDescription());
        if (!event.transitionDescriptionSaveRequested()) {
            return;
        }
        if (event.transitionId() > NO_TRANSITION_ID) {
            stateContentModel.clearTransitionDescriptionDraft(event.transitionId());
            transitionEditor.saveTransitionDescription(new SaveDungeonEditorTransitionDescriptionCommand(
                    event.transitionId(),
                    event.transitionDescription()));
        }
    }

    private void consumeStairGeometryInput(
            DungeonEditorStateViewInputEvent event
    ) {
        stateContentModel.updateStairGeometryDraft(
                event.stairId(),
                event.stairShapeName(),
                event.stairDirectionName(),
                event.stairDimension1(),
                event.stairDimension2());
        if (!event.stairGeometrySaveRequested()) {
            return;
        }
        Optional<Integer> dimension1 = parseInteger(event.stairDimension1());
        Optional<Integer> dimension2 = parseInteger(event.stairDimension2());
        if (dimension1.isEmpty() || dimension2.isEmpty()) {
            return;
        }
        stateContentModel.clearStairGeometryDraft(event.stairId());
        stairEditor.saveStairGeometry(new SaveDungeonEditorStairGeometryCommand(
                event.stairId(),
                event.stairShapeName(),
                event.stairDirectionName(),
                dimension1.orElseThrow(),
                dimension2.orElseThrow()));
    }

    private void consumeMapCanvas(DungeonMapViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (consumeInlineLabelEditEvent(event) || consumeInlineEditOutsidePressGesture(event)
                || consumeActiveInlineEditBoundary(event)
                || consumeLocalCameraInput(event) || consumeScrollInput(event) || consumeEscapeInput(event)) {
            return;
        }
        consumePointerToolInput(event);
    }

    private boolean consumeInlineLabelEditEvent(DungeonMapViewInputEvent event) {
        if (event.input().labelEditCommitted()) {
            inlineEditOutsidePressActive = false;
            commitInlineLabelEdit(event.textInput());
            return true;
        }
        if (event.input().labelEditCancelled()) {
            inlineEditOutsidePressActive = false;
            mapContentModel.clearInlineLabelEdit();
            return true;
        }
        if (event.input().labelEditTextChanged()) {
            mapContentModel.updateInlineLabelEditText(event.textInput());
            return true;
        }
        return false;
    }

    private boolean consumeInlineEditOutsidePressGesture(DungeonMapViewInputEvent event) {
        if (!inlineEditOutsidePressActive) {
            return false;
        }
        if (event.input().mouseReleased()) {
            inlineEditOutsidePressActive = false;
            lastHoverSample = Optional.empty();
            return true;
        }
        if (event.input().mouseDragged() || event.input().mouseMoved()) {
            lastHoverSample = Optional.empty();
            return true;
        }
        inlineEditOutsidePressActive = false;
        return false;
    }

    private boolean consumeActiveInlineEditBoundary(DungeonMapViewInputEvent event) {
        DungeonMapContentModel.InlineLabelEditState editState = mapContentModel.currentInlineLabelEditState();
        if (editState == null || !editState.active()) {
            return false;
        }
        if (event.input().escapePressed()) {
            return cancelActiveInlineEdit();
        }
        if (event.input().mousePressed()) {
            return consumeActiveInlineEditMousePress(event);
        }
        if (passiveInlineEditCanvasInput(event)) {
            lastHoverSample = Optional.empty();
            return true;
        }
        return false;
    }

    private boolean cancelActiveInlineEdit() {
        mapContentModel.clearInlineLabelEdit();
        inlineEditOutsidePressActive = false;
        lastHoverSample = Optional.empty();
        return true;
    }

    private boolean consumeActiveInlineEditMousePress(DungeonMapViewInputEvent event) {
        if (event.buttons().primaryButtonDown()) {
            mapContentModel.clearInlineLabelEdit();
            inlineEditOutsidePressActive = true;
        }
        lastHoverSample = Optional.empty();
        return true;
    }

    private static boolean passiveInlineEditCanvasInput(DungeonMapViewInputEvent event) {
        return event.input().mouseDragged()
                || event.input().mouseMoved()
                || event.input().mouseReleased()
                || event.input().scrolled();
    }

    private boolean consumeScrollInput(DungeonMapViewInputEvent event) {
        if (!event.input().scrolled()) {
            return false;
        }
        handleScroll(event);
        return true;
    }

    private boolean consumeEscapeInput(DungeonMapViewInputEvent event) {
        if (!event.input().escapePressed()) {
            return false;
        }
        projectionEditor.setTool(new SetDungeonEditorToolCommand(DungeonEditorTool.SELECT));
        lastHoverSample = Optional.empty();
        return true;
    }

    private void consumePointerToolInput(DungeonMapViewInputEvent event) {
        DungeonEditorTool selectedTool = presentationModel.currentInteractionState().currentSelectedTool();
        DungeonEditorTool pointerTool = pointerTool(event, selectedTool);
        if (pointerTool == null) {
            lastHoverSample = Optional.empty();
            return;
        }
        double sceneX = sceneX(event);
        double sceneY = sceneY(event);
        DungeonMapContentModel.PointerTarget pointerTarget = mapContentModel.resolvePointerTarget(sceneX, sceneY);
        if (beginInlineLabelEdit(event, sceneX, sceneY)) {
            return;
        }
        if (suppressedRepeatedHover(event, pointerTool, pointerTarget)) {
            return;
        }
        applyToolWorkflow(event, pointerSample(event, pointerTarget, pointerTool), pointerTool);
    }

    private boolean beginInlineLabelEdit(
            DungeonMapViewInputEvent event,
            double sceneX,
            double sceneY
    ) {
        if (!event.input().mousePressed()
                || event.clickCount() < 2
                || !event.buttons().primaryButtonDown()) {
            return false;
        }
        DungeonMapContentModel.PointerTarget editTarget = event.modifiers().shiftDown()
                ? mapContentModel.resolveRoomLabelPointerTarget(sceneX, sceneY)
                : mapContentModel.resolveClusterLabelPointerTarget(sceneX, sceneY);
        if (!editTarget.isLabelTarget()) {
            return false;
        }
        mapContentModel.beginInlineLabelEdit(editTarget);
        lastHoverSample = Optional.empty();
        return true;
    }

    private void commitInlineLabelEdit(String text) {
        DungeonMapContentModel.InlineLabelEditState editState = mapContentModel.currentInlineLabelEditState();
        mapContentModel.clearInlineLabelEdit();
        inlineEditOutsidePressActive = false;
        if (editState == null || !editState.active() || text == null || text.isBlank()) {
            return;
        }
        SaveDungeonEditorLabelNameCommand command = inlineLabelNameCommand(editState.target(), text);
        if (command != null) {
            labelNameEditor.saveLabelName(command);
        }
    }

    private static @Nullable SaveDungeonEditorLabelNameCommand inlineLabelNameCommand(
            DungeonMapContentModel.PointerTarget target,
            String text
    ) {
        if (target == null || !target.isLabelTarget()) {
            return null;
        }
        if (target.isClusterLabelTarget() && target.clusterId() > 0L) {
            return new SaveDungeonEditorLabelNameCommand(
                    SaveDungeonEditorLabelNameCommand.TARGET_CLUSTER,
                    target.clusterId(),
                    text);
        }
        if (target.isRoomLabelTarget() && target.topologyId() > 0L) {
            return new SaveDungeonEditorLabelNameCommand(
                    SaveDungeonEditorLabelNameCommand.TARGET_ROOM,
                    target.topologyId(),
                    text);
        }
        return null;
    }

    private boolean consumeLocalCameraInput(DungeonMapViewInputEvent event) {
        if (event.input().mousePressed() && event.buttons().middleButtonDown()) {
            beginCameraDrag(event);
            return true;
        }
        if (event.input().mouseDragged() && event.buttons().middleButtonDown()) {
            continueCameraDrag(event);
            return true;
        }
        if (event.input().mouseReleased() && event.buttons().middleButtonDown()) {
            cameraDragActive = false;
            return true;
        }
        if (event.input().scrolled() && !event.modifiers().controlDown()) {
            zoomCamera(event);
            return true;
        }
        return event.buttons().middleButtonDown();
    }

    private void beginCameraDrag(DungeonMapViewInputEvent event) {
        cameraDragActive = true;
        lastCameraDragCanvasX = event.position().canvasX();
        lastCameraDragCanvasY = event.position().canvasY();
    }

    private void continueCameraDrag(DungeonMapViewInputEvent event) {
        if (!cameraDragActive) {
            beginCameraDrag(event);
            return;
        }
        double nextCanvasX = event.position().canvasX();
        double nextCanvasY = event.position().canvasY();
        mapContentModel.panByPixels(nextCanvasX - lastCameraDragCanvasX, nextCanvasY - lastCameraDragCanvasY);
        lastCameraDragCanvasX = nextCanvasX;
        lastCameraDragCanvasY = nextCanvasY;
    }

    private void zoomCamera(DungeonMapViewInputEvent event) {
        double scrollDeltaY = event.scrollDeltaY();
        double noScrollDelta = 0.0;
        double zoomInFactor = 1.1;
        if (scrollDeltaY > noScrollDelta) {
            mapContentModel.zoomAround(
                    event.position().canvasX(),
                    event.position().canvasY(),
                    zoomInFactor);
        } else if (scrollDeltaY < noScrollDelta) {
            mapContentModel.zoomAround(
                    event.position().canvasX(),
                    event.position().canvasY(),
                    1.0 / zoomInFactor);
        }
    }

    private static boolean secondaryOnly(DungeonMapViewInputEvent event) {
        return event.buttons().secondaryButtonDown()
                && !event.buttons().primaryButtonDown()
                && !event.buttons().middleButtonDown()
                && !event.modifiers().shiftDown();
    }

    private static DungeonEditorTool pointerTool(
            DungeonMapViewInputEvent event,
            DungeonEditorTool selectedTool
    ) {
        if (shiftSecondary(event)) {
            return alternateTool(selectedTool);
        }
        if (selectedTool == DungeonEditorTool.WALL_CREATE && deleteGesture(event)) {
            return DungeonEditorTool.WALL_CREATE;
        }
        return deleteGesture(event) ? deleteTool(selectedTool) : selectedTool;
    }

    private static boolean shiftSecondary(DungeonMapViewInputEvent event) {
        return event.buttons().secondaryButtonDown() && event.modifiers().shiftDown();
    }

    private static boolean deleteGesture(DungeonMapViewInputEvent event) {
        return secondaryOnly(event);
    }

    private static @Nullable DungeonEditorTool deleteTool(DungeonEditorTool selectedTool) {
        return DELETE_TOOLS.get(selectedTool);
    }

    private static @Nullable DungeonEditorTool alternateTool(DungeonEditorTool selectedTool) {
        return selectedTool == DungeonEditorTool.WALL_CREATE ? selectedTool : null;
    }

    private static Map<DungeonEditorTool, DungeonEditorTool> deleteTools() {
        Map<DungeonEditorTool, DungeonEditorTool> tools = new EnumMap<>(DungeonEditorTool.class);
        registerDeleteTool(tools, DungeonEditorTool.ROOM_PAINT, DungeonEditorTool.ROOM_DELETE);
        registerDeleteTool(tools, DungeonEditorTool.WALL_CREATE, DungeonEditorTool.WALL_DELETE);
        registerDeleteTool(tools, DungeonEditorTool.DOOR_CREATE, DungeonEditorTool.DOOR_DELETE);
        registerDeleteTool(tools, DungeonEditorTool.CORRIDOR_CREATE, DungeonEditorTool.CORRIDOR_DELETE);
        registerDeleteTool(tools, DungeonEditorTool.STAIR_CREATE, DungeonEditorTool.STAIR_DELETE);
        registerDeleteTool(tools, DungeonEditorTool.STAIR_CREATE_SQUARE, DungeonEditorTool.STAIR_DELETE);
        registerDeleteTool(tools, DungeonEditorTool.STAIR_CREATE_CIRCULAR, DungeonEditorTool.STAIR_DELETE);
        registerDeleteTool(tools, DungeonEditorTool.TRANSITION_CREATE, DungeonEditorTool.TRANSITION_DELETE);
        return Map.copyOf(tools);
    }

    private static void registerDeleteTool(
            Map<DungeonEditorTool, DungeonEditorTool> tools,
            DungeonEditorTool primary,
            DungeonEditorTool delete
    ) {
        tools.put(primary, delete);
        tools.put(delete, delete);
    }

    private void applyToolWorkflow(
            DungeonMapViewInputEvent event,
            DungeonEditorPointerSample pointerSample,
            DungeonEditorTool tool
    ) {
        DungeonMapViewInputEvent.CanvasInput input = event.input();
        ApplyDungeonEditorPointerCommand command = pointerCommand(
                tool,
                input,
                pointerSample,
                wallSingleClickMode(event, tool),
                stateContentModel.currentTransitionDestinationType(),
                stateContentModel.currentTransitionDestinationMapId(),
                stateContentModel.currentTransitionDestinationTileId(),
                stateContentModel.currentTransitionDestinationTransitionId());
        if (command != null) {
            pointerEditor.applyPointer(command);
        }
    }

    private void handleScroll(DungeonMapViewInputEvent event) {
        if (!event.modifiers().controlDown()) {
            return;
        }
        int levelDelta = normalizeLevelDelta(event.scrollDeltaY());
        if (levelDelta != 0) {
            pointerEditor.scrollSelection(new ShiftDungeonEditorProjectionLevelCommand(levelDelta));
        }
    }

    private static @Nullable ApplyDungeonEditorPointerCommand pointerCommand(
            DungeonEditorTool tool,
            DungeonMapViewInputEvent.CanvasInput input,
            DungeonEditorPointerSample pointerSample,
            boolean wallSingleClickMode,
            String transitionDestinationType,
            long transitionDestinationMapId,
            long transitionDestinationTileId,
            long transitionDestinationTransitionId
    ) {
        if (input.mousePressed()) {
            if (tool == DungeonEditorTool.TRANSITION_CREATE) {
                return ApplyDungeonEditorPointerCommand.pressedWithTransitionDestination(
                        tool,
                        pointerSample,
                        wallSingleClickMode,
                        transitionDestinationType,
                        transitionDestinationMapId,
                        transitionDestinationTileId,
                        transitionDestinationTransitionId);
            }
            return ApplyDungeonEditorPointerCommand.pressed(tool, pointerSample, wallSingleClickMode);
        }
        if (input.mouseDragged()) {
            return ApplyDungeonEditorPointerCommand.dragged(tool, pointerSample, wallSingleClickMode);
        }
        if (input.mouseReleased()) {
            return ApplyDungeonEditorPointerCommand.released(tool, pointerSample, wallSingleClickMode);
        }
        if (input.mouseMoved()) {
            return ApplyDungeonEditorPointerCommand.moved(tool, pointerSample, wallSingleClickMode);
        }
        return null;
    }

    private boolean wallSingleClickMode(DungeonMapViewInputEvent event, DungeonEditorTool tool) {
        return tool == DungeonEditorTool.WALL_CREATE
                && (event.modifiers().controlDown() || controlsContentModel.wallSingleClickModeSelected());
    }

    private DungeonEditorPointerSample pointerSample(
            DungeonMapViewInputEvent event,
            DungeonMapContentModel.PointerTarget target,
            DungeonEditorTool tool
    ) {
        return new DungeonEditorPointerSample(
                sceneX(event),
                sceneY(event),
                event.buttons().primaryButtonDown(),
                event.buttons().secondaryButtonDown(),
                DungeonEditorPointerTargetTranslator.toPublishedPointerTarget(target, tool));
    }

    private boolean suppressedRepeatedHover(
            DungeonMapViewInputEvent event,
            DungeonEditorTool selectedTool,
            DungeonMapContentModel.PointerTarget target
    ) {
        if (!event.input().mouseMoved()) {
            lastHoverSample = Optional.empty();
            return false;
        }
        HoverSample nextSample = HoverSample.from(
                selectedTool,
                target,
                sceneX(event),
                sceneY(event),
                presentationModel.currentInteractionState().currentProjectionLevel(),
                0.22);
        if (lastHoverSample.filter(nextSample::matches).isPresent()) {
            return true;
        }
        lastHoverSample = Optional.of(nextSample);
        return false;
    }

    private static int normalizeLevelDelta(double scrollDeltaY) {
        double noScrollDelta = 0.0;
        if (scrollDeltaY > noScrollDelta) {
            return 1;
        }
        if (scrollDeltaY < noScrollDelta) {
            return -1;
        }
        return 0;
    }

    private double sceneX(DungeonMapViewInputEvent event) {
        return mapContentModel.currentViewport().screenToSceneX(event.position().canvasX());
    }

    private double sceneY(DungeonMapViewInputEvent event) {
        return mapContentModel.currentViewport().screenToSceneY(event.position().canvasY());
    }

    private void handleMapSelection(long selectedMapIdValue) {
        DungeonEditorContributionModel.InteractionState interactionState = presentationModel.currentInteractionState();
        long noSelectedMapId = 0L;
        if (selectedMapIdValue > noSelectedMapId
            && selectedMapIdValue != interactionState.currentSelectedMapIdValue()) {
            mapEditor.selectMap(new SelectDungeonEditorMapCommand(new DungeonMapId(selectedMapIdValue)));
        }
    }

    private void reloadSelectedMap(long selectedMapIdValue) {
        long noSelectedMapId = 0L;
        if (selectedMapIdValue > noSelectedMapId) {
            mapEditor.selectMap(new SelectDungeonEditorMapCommand(new DungeonMapId(selectedMapIdValue)));
        }
    }

    private void handleMapEditor(DungeonEditorControlsViewInputEvent.MapSnapshot map) {
        controlsContentModel.updateMapEditorDraft(map.editorDraftName());
        DungeonEditorContributionModel.InteractionState interactionState = presentationModel.currentInteractionState();
        if (map.dismissControlActivated()) {
            controlsContentModel.closeMapEditor();
            return;
        }
        if (map.createControlActivated()) {
            controlsContentModel.openCreateMapEditor();
            return;
        }
        if (map.renameControlActivated()) {
            controlsContentModel.openSelectedMapEditor(
                    DungeonEditorControlsContentModel.MapEditorMode.RENAME,
                    interactionState.currentSelectedMapIdValue());
            return;
        }
        if (map.deleteControlActivated()) {
            controlsContentModel.openSelectedMapEditor(
                    DungeonEditorControlsContentModel.MapEditorMode.DELETE,
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
        DungeonEditorControlsContentModel.MapEditorUiState mapEditorUiState =
                controlsContentModel.currentMapEditorUiState();
        String draftName = mapEditorUiState.draftName().strip();
        if (draftName.isBlank()) {
            controlsContentModel.showMapEditorValidationError("Name fehlt.");
            return;
        }
        if (mapEditorUiState.isCreateMode()) {
            controlsContentModel.closeMapEditor();
            mapEditor.createMap(new DungeonMapCatalogCommand.CreateMapCommand(draftName));
            return;
        }
        if (mapEditorUiState.isRenameMode()) {
            submitRename(mapEditorUiState, draftName);
        }
    }

    private void createMap(String draftName) {
        String safeDraftName = draftName == null ? "" : draftName.strip();
        if (safeDraftName.isBlank()) {
            controlsContentModel.showMapEditorValidationError("Name fehlt.");
            return;
        }
        controlsContentModel.closeMapEditor();
        mapEditor.createMap(new DungeonMapCatalogCommand.CreateMapCommand(safeDraftName));
    }

    private void renameMap(long mapIdValue, String draftName) {
        String safeDraftName = draftName == null ? "" : draftName.strip();
        if (safeDraftName.isBlank()) {
            controlsContentModel.showMapEditorValidationError("Name fehlt.");
            return;
        }
        long noSelectedMapId = 0L;
        if (mapIdValue > noSelectedMapId) {
            controlsContentModel.closeMapEditor();
            mapEditor.renameMap(new DungeonMapCatalogCommand.RenameMapCommand(new DungeonMapId(mapIdValue), safeDraftName));
        }
    }

    private void deleteMap(long mapIdValue) {
        long noSelectedMapId = 0L;
        if (mapIdValue > noSelectedMapId) {
            controlsContentModel.closeMapEditor();
            mapEditor.deleteMap(new DeleteDungeonMapCommand(new DungeonMapId(mapIdValue)));
        }
    }

    private void submitRename(DungeonEditorControlsContentModel.MapEditorUiState mapEditorUiState, String draftName) {
        long mapIdValue = mapEditorUiState.mapIdValue();
        long noSelectedMapId = 0L;
        if (mapIdValue > noSelectedMapId) {
            controlsContentModel.closeMapEditor();
            mapEditor.renameMap(new DungeonMapCatalogCommand.RenameMapCommand(new DungeonMapId(mapIdValue), draftName));
        }
    }

    private void handleMapDelete() {
        DungeonEditorControlsContentModel.MapEditorUiState mapEditorUiState =
                controlsContentModel.currentMapEditorUiState();
        if (!mapEditorUiState.isDeleteMode()) {
            return;
        }
        long mapIdValue = mapEditorUiState.mapIdValue();
        long noSelectedMapId = 0L;
        if (mapIdValue > noSelectedMapId) {
            controlsContentModel.closeMapEditor();
            mapEditor.deleteMap(new DeleteDungeonMapCommand(new DungeonMapId(mapIdValue)));
        }
    }

    private void handleViewMode(@Nullable String viewModeKey) {
        if (viewModeKey == null || viewModeKey.isBlank()) {
            return;
        }
        String normalizedViewModeKey = DungeonEditorControlsContentModel.normalizeViewModeKey(viewModeKey);
        String selectedViewMode = presentationModel.currentInteractionState().currentViewModeKey();
        if (DungeonEditorControlsContentModel.graphViewLabel().equals(normalizedViewModeKey)) {
            if (!DungeonEditorControlsContentModel.graphViewLabel().equals(selectedViewMode)) {
                projectionEditor.setViewMode(new SetDungeonEditorViewModeCommand(
                        DungeonEditorControlsContentModel.toPublishedViewMode(normalizedViewModeKey)));
            }
            return;
        }
        if (!DungeonEditorControlsContentModel.gridViewLabel().equals(selectedViewMode)) {
            projectionEditor.setViewMode(new SetDungeonEditorViewModeCommand(
                    DungeonEditorControlsContentModel.toPublishedViewMode(
                            DungeonEditorControlsContentModel.gridViewLabel())));
        }
    }

    private void handleToolInput(DungeonEditorControlsViewInputEvent.ToolSnapshot tool) {
        if (tool.dismissControlActivated()) {
            projectionEditor.setTool(new SetDungeonEditorToolCommand(DungeonEditorTool.SELECT));
            lastHoverSample = Optional.empty();
            return;
        }
        if (tool.selectedToolKey().isBlank()) {
            return;
        }
        DungeonEditorContributionModel.InteractionState interactionState = presentationModel.currentInteractionState();
        String selectedToolKey = tool.selectedToolKey();
        DungeonEditorTool selectedTool = DungeonEditorControlsContentModel.toPublishedToolKey(selectedToolKey);
        controlsContentModel.rememberToolSelection(
                tool.requestedFamilyKey(),
                selectedTool.name(),
                tool.selectedOptionKey());
        if (selectedTool != interactionState.currentSelectedTool()) {
            projectionEditor.setTool(new SetDungeonEditorToolCommand(selectedTool));
        }
    }

    private void handleOverlayInput(DungeonEditorControlsViewInputEvent.OverlaySnapshot overlay) {
        DungeonEditorContributionModel.OverlayProjection currentOverlay =
                presentationModel.currentInteractionState().currentOverlayProjection();
        Optional<List<Integer>> parsedSelectedLevels = parseLevels(overlay.selectedLevelsText());
        if (parsedSelectedLevels.isEmpty()) {
            return;
        }
        List<Integer> selectedLevels = parsedSelectedLevels.orElseThrow();
        List<Integer> currentSelectedLevels = parseLevels(currentOverlay.selectedLevelsText()).orElse(List.of());
        if (currentOverlay.modeKey().equals(overlay.modeKey())
                && currentOverlay.levelRange() == overlay.levelRange()
                && Double.compare(currentOverlay.opacity(), overlay.opacity()) == 0
                && currentSelectedLevels.equals(selectedLevels)) {
            return;
        }
        projectionEditor.setOverlay(new SetDungeonEditorOverlayCommand(new DungeonOverlaySettings(
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
        return !tool.requestedFamilyKey().isBlank()
                || !tool.selectedToolKey().isBlank()
                || tool.dismissControlActivated();
    }

    private static Optional<List<Integer>> parseLevels(@Nullable String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.of(List.of());
        }
        try {
            return Optional.of(java.util.Arrays.stream(raw.split(","))
                    .map(String::trim)
                    .filter(part -> !part.isBlank())
                    .map(Integer::parseInt)
                    .sorted()
                    .distinct()
                    .toList());
        } catch (NumberFormatException exception) {
            return Optional.empty();
        }
    }

    private void submitCorridorPointMove(DungeonEditorStateViewInputEvent event) {
        DungeonEditorHandleRef handleRef = stateContentModel.currentEditableCorridorHandle();
        if (handleRef == null) {
            return;
        }
        Optional<Integer> q = parseInteger(event.corridorPointQ());
        Optional<Integer> r = parseInteger(event.corridorPointR());
        if (q.isEmpty() || r.isEmpty()) {
            return;
        }
        pointerEditor.moveHandle(new MoveDungeonEditorHandleCommand(handleRef, q.orElseThrow(), r.orElseThrow()));
        stateContentModel.clearCorridorPointDraft(handleRef);
    }

    private static Optional<Integer> parseInteger(@Nullable String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(Integer.parseInt(raw.strip()));
        } catch (NumberFormatException ignored) {
            return Optional.empty();
        }
    }

    private long selectedTransitionId() {
        return stateContentModel.currentSelectedTransitionId();
    }

    record ApplicationServices(
            DungeonEditorMapApplicationService mapEditor,
            DungeonEditorProjectionApplicationService projectionEditor,
            DungeonEditorPointerApplicationService pointerEditor,
            DungeonEditorNarrationApplicationService narrationEditor,
            DungeonEditorLabelNameApplicationService labelNameEditor,
            DungeonEditorTransitionApplicationService transitionEditor,
            DungeonEditorStairApplicationService stairEditor
    ) {
        ApplicationServices {
            Objects.requireNonNull(mapEditor, "mapEditor");
            Objects.requireNonNull(projectionEditor, "projectionEditor");
            Objects.requireNonNull(pointerEditor, "pointerEditor");
            Objects.requireNonNull(narrationEditor, "narrationEditor");
            Objects.requireNonNull(labelNameEditor, "labelNameEditor");
            Objects.requireNonNull(transitionEditor, "transitionEditor");
            Objects.requireNonNull(stairEditor, "stairEditor");
        }
    }

    private static long parseLongOrZero(@Nullable String raw) {
        if (raw == null || raw.isBlank()) {
            return 0L;
        }
        try {
            return Math.max(0L, Long.parseLong(raw.strip()));
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }

    private @Nullable SaveDungeonEditorRoomNarrationCommand toSaveRoomNarrationCommand(
            DungeonEditorStateViewInputEvent event
    ) {
        DungeonEditorStateContentModel.RoomNarrationCardProjection card =
                stateContentModel.currentNarrationCard(event.roomId());
        if (card == null) {
            return null;
        }
        List<DungeonEditorStateContentModel.RoomExitNarrationProjection> exits =
                stateContentModel.currentExitsWithDraftDescriptions(card);
        return new SaveDungeonEditorRoomNarrationCommand(
                card.roomId(),
                stateContentModel.currentVisualDescription(card),
                exits.stream().map(DungeonEditorStateContentModel.RoomExitNarrationProjection::label).toList(),
                exits.stream().map(DungeonEditorStateContentModel.RoomExitNarrationProjection::q).toList(),
                exits.stream().map(DungeonEditorStateContentModel.RoomExitNarrationProjection::r).toList(),
                exits.stream().map(DungeonEditorStateContentModel.RoomExitNarrationProjection::level).toList(),
                exits.stream().map(DungeonEditorStateContentModel.RoomExitNarrationProjection::direction).toList(),
                exits.stream().map(DungeonEditorStateContentModel.RoomExitNarrationProjection::description).toList());
    }

    private static final class HoverSample {
        private final DungeonEditorTool tool;
        private final int projectionLevel;
        private final int cellQ;
        private final int cellR;
        private final boolean vertexPresent;
        private final int vertexQ;
        private final int vertexR;
        private final DungeonMapContentModel.PointerTarget target;

        private HoverSample(
                DungeonEditorTool tool,
                int projectionLevel,
                int cellQ,
                int cellR,
                boolean vertexPresent,
                int vertexQ,
                int vertexR,
                DungeonMapContentModel.PointerTarget target
        ) {
            this.tool = tool;
            this.projectionLevel = projectionLevel;
            this.cellQ = cellQ;
            this.cellR = cellR;
            this.vertexPresent = vertexPresent;
            this.vertexQ = vertexQ;
            this.vertexR = vertexR;
            this.target = target;
        }

        private static HoverSample from(
                DungeonEditorTool tool,
                DungeonMapContentModel.PointerTarget target,
                double sceneX,
                double sceneY,
                int projectionLevel,
                double vertexSnapDistance
        ) {
            int vertexQ = (int) Math.round(sceneX);
            int vertexR = (int) Math.round(sceneY);
            boolean vertexPresent = Math.hypot(sceneX - vertexQ, sceneY - vertexR) <= vertexSnapDistance;
            return new HoverSample(
                    tool == null ? DungeonEditorTool.SELECT : tool,
                    projectionLevel,
                    (int) Math.floor(sceneX),
                    (int) Math.floor(sceneY),
                    vertexPresent,
                    vertexQ,
                    vertexR,
                    target == null ? DungeonMapContentModel.PointerTarget.empty() : target);
        }

        private boolean matches(HoverSample other) {
            return other != null
                    && tool == other.tool
                    && projectionLevel == other.projectionLevel
                    && cellQ == other.cellQ
                    && cellR == other.cellR
                    && vertexPresent == other.vertexPresent
                    && vertexQ == other.vertexQ
                    && vertexR == other.vertexR
                    && Objects.equals(target, other.target);
        }
    }

    private interface DungeonEditorPointerTargetTranslator {

        static DungeonEditorPointerTarget toPublishedPointerTarget(
                DungeonMapContentModel.PointerTarget target,
                @Nullable DungeonEditorTool tool
        ) {
            DungeonMapContentModel.PointerTarget safeTarget = target == null
                    ? DungeonMapContentModel.PointerTarget.empty()
                    : target;
            DungeonEditorPointerTarget doorDeleteTarget = doorDeleteBoundaryTarget(safeTarget, tool);
            return doorDeleteTarget == null ? pointerTarget(safeTarget) : doorDeleteTarget;
        }

        private static @Nullable DungeonEditorPointerTarget doorDeleteBoundaryTarget(
                DungeonMapContentModel.PointerTarget target,
                @Nullable DungeonEditorTool tool
        ) {
            if (tool != DungeonEditorTool.DOOR_DELETE || !target.isHandleTarget()) {
                return null;
            }
            DungeonMapContentModel.HandleTarget handle = target.handleRef();
            if (handle.kind() == null || !handle.kind().isDoor() || !handle.sourceEdgeTarget().present()) {
                return null;
            }
            return DungeonEditorPointerTarget.boundary(doorBoundaryRef(handle));
        }

        private static DungeonEditorPointerTarget pointerTarget(DungeonMapContentModel.PointerTarget target) {
            return switch (target.targetKind()) {
                case EMPTY -> DungeonEditorPointerTarget.empty();
                case CELL -> DungeonEditorPointerTarget.cell(
                        topologyElementKind(target.elementKind()),
                        target.ownerId(),
                        target.clusterId(),
                        topologyRef(target.topologyKind(), target.topologyId()));
                case LABEL -> DungeonEditorPointerTarget.label(
                        target.ownerId(),
                        target.clusterId(),
                        topologyRef(target.topologyKind(), target.topologyId()),
                        target.labelKind());
                case GRAPH_NODE -> DungeonEditorPointerTarget.graphNode(
                        target.ownerId(),
                        target.clusterId(),
                        topologyRef(target.topologyKind(), target.topologyId()));
                case HANDLE -> DungeonEditorPointerTarget.handle(handleRef(target.handleRef()));
                case BOUNDARY -> DungeonEditorPointerTarget.boundary(boundaryRef(target.boundaryRef()));
            };
        }

        private static DungeonEditorBoundaryTargetRef doorBoundaryRef(DungeonMapContentModel.HandleTarget handle) {
            DungeonMapContentModel.HandleTarget.SourceEdgeTarget sourceEdge = handle.sourceEdgeTarget();
            return new DungeonEditorBoundaryTargetRef(
                    DungeonBoundaryKind.DOOR,
                    "",
                    handle.ownerId(),
                    topologyRef(handle.topologyKind(), handle.topologyId()),
                    cellRef(sourceEdge.startQ(), sourceEdge.startR(), sourceEdge.startLevel()),
                    cellRef(sourceEdge.endQ(), sourceEdge.endR(), sourceEdge.endLevel()));
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
            DungeonEditorHandleRef baseRef = new DungeonEditorHandleRef(
                    safeHandle.kind(),
                    topologyRef(safeHandle.topologyKind(), safeHandle.topologyId()),
                    safeHandle.ownerId(),
                    safeHandle.clusterId(),
                    safeHandle.corridorId(),
                    safeHandle.roomId(),
                    safeHandle.orderIndex(),
                    cellRef(safeHandle.q(), safeHandle.r(), safeHandle.level()),
                    safeHandle.direction(),
                    null);
            DungeonMapContentModel.HandleTarget.SourceEdgeTarget sourceEdge = safeHandle.sourceEdgeTarget();
            return sourceEdge.present()
                    ? DungeonEditorHandleRef.withSourceEdge(
                            baseRef,
                            cellRef(sourceEdge.startQ(), sourceEdge.startR(), sourceEdge.startLevel()),
                            cellRef(sourceEdge.endQ(), sourceEdge.endR(), sourceEdge.endLevel()))
                    : baseRef;
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

        private static DungeonTopologyElementKind topologyElementKind(String value) {
            try {
                return DungeonTopologyElementKind.valueOf(normalizedEnumName(value));
            } catch (IllegalArgumentException ignored) {
                return DungeonTopologyElementKind.EMPTY;
            }
        }

        private static String normalizedEnumName(String value) {
            return value == null ? "" : value.trim().toUpperCase(Locale.ROOT).replace('-', '_');
        }
    }

}
