package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts;
import src.features.dungeon.runtime.DungeonEditorInlineLabelEditSession;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.BoundaryTarget;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.ExitNarration;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.HandleTarget;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerAction;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerSample;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerTarget;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerWorkflowGesture;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerWorkflowIntent;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.RoomNarrationDraftInput;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.RoomNarration;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.ExitNarrationDraftInput;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.StairGeometryDraftInput;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.TransitionDestination;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsViewInputEvent;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapViewInputEvent;

final class DungeonEditorIntentHandler {
    private static final long NO_TRANSITION_ID = 0L;

    private final DungeonEditorContributionModel presentationModel;
    private final DungeonEditorControlsContentModel controlsContentModel;
    private final CatalogCrudControlsContentModel catalogContentModel;
    private final DungeonEditorStateContentModel stateContentModel;
    private final DungeonMapContentModel mapContentModel;
    private final DungeonEditorRuntimeOperations operations;
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
            DungeonEditorRuntimeOperations operations
    ) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.controlsContentModel = Objects.requireNonNull(controlsContentModel, "controlsContentModel");
        this.catalogContentModel = Objects.requireNonNull(catalogContentModel, "catalogContentModel");
        this.stateContentModel = Objects.requireNonNull(stateContentModel, "stateContentModel");
        this.mapContentModel = Objects.requireNonNull(mapContentModel, "mapContentModel");
        this.operations = Objects.requireNonNull(operations, "operations");
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
            operations.shiftProjectionLevel(levelShift);
            return;
        }
        if (!overlay.modeKey().isBlank()) {
            handleOverlayInput(overlay);
        }
    }

    void consume(CatalogCrudControlsViewInputEvent event) {
        if (event == null) {
            return;
        }
        catalogContentModel.updateSelectorFilter(event.selectorFilterText());
        if (consumeCatalogSelection(event) || consumeCatalogSubmit(event)) {
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
            operations.updateStatePanelTransitionDestinationDraft(
                    new DungeonEditorRuntimeOperations.TransitionDestinationDraftInput(
                            event.transitionDestinationType(),
                            event.transitionDestinationMapId(),
                            event.transitionDestinationTileId(),
                            event.transitionDestinationTransitionId(),
                            event.transitionDestinationBidirectional()));
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
        operations.saveTransitionLink(
                sourceTransitionId,
                parseLongOrZero(event.transitionDestinationMapId()),
                parseLongOrZero(event.transitionDestinationTransitionId()),
                event.transitionDestinationBidirectional());
    }

    private void consumeStairGeometryWhenPresent(DungeonEditorStateViewInputEvent event) {
        if (event.stairGeometryInputObserved() || event.stairGeometrySaveRequested()) {
            consumeStairGeometryInput(event);
        }
    }

    private void consumeNarrationInput(DungeonEditorStateViewInputEvent event) {
        RoomNarrationDraftInput draftInput = toRoomNarrationDraftInput(event);
        if (draftInput != null) {
            operations.updateStatePanelRoomNarrationDraft(draftInput);
        }
        if (!event.narrationSaveRequested()) {
            return;
        }
        RoomNarration narration = toRoomNarration(event);
        if (narration != null) {
            operations.saveRoomNarration(narration);
        }
    }

    private void consumeLabelNameInput(DungeonEditorStateViewInputEvent event) {
        operations.updateStatePanelLabelNameDraft(
                event.nameTargetKind(),
                event.nameTargetId(),
                event.labelName());
        if (!event.labelNameSaveRequested() || event.nameTargetId() <= 0L || event.labelName().isBlank()) {
            return;
        }
        operations.saveLabelName(
                event.nameTargetKind(),
                event.nameTargetId(),
                event.labelName());
    }

    private void consumeCorridorPointInput(DungeonEditorStateViewInputEvent event) {
        operations.updateStatePanelCorridorPointDraft(
                event.corridorPointQ(),
                event.corridorPointR());
        if (event.corridorPointSubmitRequested()) {
            submitCorridorPointMove(event);
        }
    }

    private void consumeTransitionDescriptionInput(
            DungeonEditorStateViewInputEvent event
    ) {
        operations.updateStatePanelTransitionDescriptionDraft(
                event.transitionId(),
                event.transitionDescription());
        if (!event.transitionDescriptionSaveRequested()) {
            return;
        }
        if (event.transitionId() > NO_TRANSITION_ID) {
            operations.saveTransitionDescription(
                    event.transitionId(),
                    event.transitionDescription());
        }
    }

    private void consumeStairGeometryInput(
            DungeonEditorStateViewInputEvent event
    ) {
        operations.updateStatePanelStairGeometryDraft(new StairGeometryDraftInput(
                event.stairId(),
                event.stairShapeName(),
                event.stairDirectionName(),
                event.stairDimension1(),
                event.stairDimension2()));
        if (!event.stairGeometrySaveRequested()) {
            return;
        }
        Optional<Integer> dimension1 = parseInteger(event.stairDimension1());
        Optional<Integer> dimension2 = parseInteger(event.stairDimension2());
        if (dimension1.isEmpty() || dimension2.isEmpty()) {
            return;
        }
        operations.saveStairGeometry(
                event.stairId(),
                event.stairShapeName(),
                event.stairDirectionName(),
                dimension1.orElseThrow(),
                dimension2.orElseThrow());
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
            operations.cancelInlineLabelEdit();
            return true;
        }
        if (event.input().labelEditTextChanged()) {
            operations.updateInlineLabelEditDraft(event.textInput());
            return true;
        }
        return false;
    }

    private boolean consumeInlineEditOutsidePressGesture(DungeonMapViewInputEvent event) {
        if (!inlineEditOutsidePressActive) {
            return false;
        }
        if (event.input().mouseReleased()) {
            mapContentModel.clearHoverTarget();
            inlineEditOutsidePressActive = false;
            operations.clearPointerSession();
            return true;
        }
        if (event.input().mouseDragged() || event.input().mouseMoved()) {
            mapContentModel.clearHoverTarget();
            operations.clearPointerSession();
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
            mapContentModel.clearHoverTarget();
            operations.clearPointerSession();
            return true;
        }
        return false;
    }

    private boolean cancelActiveInlineEdit() {
        operations.cancelInlineLabelEdit();
        mapContentModel.clearHoverTarget();
        inlineEditOutsidePressActive = false;
        operations.clearPointerSession();
        return true;
    }

    private boolean consumeActiveInlineEditMousePress(DungeonMapViewInputEvent event) {
        if (event.buttons().primaryButtonDown()) {
            operations.cancelInlineLabelEdit();
            inlineEditOutsidePressActive = true;
        }
        mapContentModel.clearHoverTarget();
        operations.clearPointerSession();
        return true;
    }

    private static boolean passiveInlineEditCanvasInput(DungeonMapViewInputEvent event) {
        return event.input().mouseDragged()
                || event.input().mouseMoved()
                || event.input().mouseExited()
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
        operations.cancelActivePreviewSession();
        mapContentModel.clearHoverTarget();
        return true;
    }

    private void consumePointerToolInput(DungeonMapViewInputEvent event) {
        String selectedTool = presentationModel.currentInteractionState().currentSelectedToolKey();
        PointerAction action = pointerAction(event.input());
        PointerWorkflowIntent intent = operations.pointerWorkflowIntent(
                selectedTool,
                pointerWorkflowGesture(event));
        if (!intent.workflowAccepted()) {
            mapContentModel.clearHoverTarget();
            operations.clearPointerSession();
            return;
        }
        double sceneX = sceneX(event);
        double sceneY = sceneY(event);
        DungeonMapContentModel.PointerTarget pointerTarget = intent.boundaryTargetsPreferred()
                ? mapContentModel.resolvePointerTarget(sceneX, sceneY, true)
                : mapContentModel.resolvePointerTarget(sceneX, sceneY);
        if (beginInlineLabelEdit(event, sceneX, sceneY)) {
            return;
        }
        updateHoverTarget(event, pointerTarget);
        PointerSample sample = pointerSample(event, pointerTarget);
        if (suppressedRepeatedHover(action, intent.effectiveToolKey(), sample)) {
            return;
        }
        applyToolWorkflow(action, sample, intent);
    }

    private void updateHoverTarget(
            DungeonMapViewInputEvent event,
            DungeonMapContentModel.PointerTarget pointerTarget
    ) {
        if (event.input().mouseMoved()) {
            mapContentModel.updateHoverTarget(pointerTarget);
            return;
        }
        if (event.input().mouseExited()) {
            mapContentModel.clearHoverTarget();
            return;
        }
        if (event.input().mousePressed()
                || event.input().mouseDragged()
                || event.input().mouseReleased()
                || event.input().scrolled()) {
            mapContentModel.clearHoverTarget();
        }
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
        Optional<DungeonMapContentModel.InlineLabelEditCandidate> editCandidate =
                mapContentModel.inlineLabelEditCandidate(editTarget);
        if (editCandidate.isEmpty()) {
            return false;
        }
        operations.beginInlineLabelEdit(inlineLabelEditSession(editCandidate.orElseThrow()));
        mapContentModel.clearHoverTarget();
        operations.clearPointerSession();
        return true;
    }

    private void commitInlineLabelEdit(String text) {
        inlineEditOutsidePressActive = false;
        operations.commitInlineLabelEdit(text);
    }

    private static DungeonEditorInlineLabelEditSession inlineLabelEditSession(
            DungeonMapContentModel.InlineLabelEditCandidate candidate
    ) {
        DungeonMapContentModel.PointerTarget target = candidate.target();
        LabelNameInput input = inlineLabelNameInput(target);
        return DungeonEditorInlineLabelEditSession.active(
                new DungeonEditorInlineLabelEditSession.Target(
                        input.targetKind(),
                        input.targetId(),
                        target.labelKind(),
                        target.ownerId(),
                        target.clusterId(),
                        target.topologyKind(),
                        target.topologyId()),
                candidate.text(),
                new DungeonEditorInlineLabelEditSession.Placement(
                        candidate.centerX(),
                        candidate.centerY(),
                        candidate.width(),
                        candidate.height(),
                        candidate.rotationDegrees()));
    }

    private static LabelNameInput inlineLabelNameInput(DungeonMapContentModel.PointerTarget target) {
        if (target.isClusterLabelTarget() && target.clusterId() > 0L) {
            return new LabelNameInput(
                    "CLUSTER",
                    target.clusterId());
        }
        if (target.isRoomLabelTarget() && target.topologyId() > 0L) {
            return new LabelNameInput(
                    "ROOM",
                    target.topologyId());
        }
        return LabelNameInput.empty();
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

    private void applyToolWorkflow(
            PointerAction action,
            PointerSample pointerSample,
            PointerWorkflowIntent intent
    ) {
        if (action != null) {
            operations.applyPointer(
                    action,
                    intent.effectiveToolKey(),
                    pointerSample,
                    intent.wallSingleClickMode(),
                    transitionDestination());
        }
    }

    private void handleScroll(DungeonMapViewInputEvent event) {
        if (!event.modifiers().controlDown()) {
            return;
        }
        int levelDelta = normalizeLevelDelta(event.scrollDeltaY());
        if (levelDelta != 0) {
            operations.scrollSelection(levelDelta);
        }
    }

    private static @Nullable PointerAction pointerAction(DungeonMapViewInputEvent.CanvasInput input) {
        if (input.mousePressed()) {
            return PointerAction.PRESSED;
        }
        if (input.mouseDragged()) {
            return PointerAction.DRAGGED;
        }
        if (input.mouseReleased()) {
            return PointerAction.RELEASED;
        }
        if (input.mouseMoved()) {
            return PointerAction.MOVED;
        }
        return null;
    }

    private TransitionDestination transitionDestination() {
        return new TransitionDestination(
                stateContentModel.currentTransitionDestinationType(),
                stateContentModel.currentTransitionDestinationMapId(),
                stateContentModel.currentTransitionDestinationTileId(),
                stateContentModel.currentTransitionDestinationTransitionId());
    }

    private PointerSample pointerSample(
            DungeonMapViewInputEvent event,
            DungeonMapContentModel.PointerTarget target
    ) {
        return new PointerSample(
                sceneX(event),
                sceneY(event),
                event.buttons().primaryButtonDown(),
                event.buttons().secondaryButtonDown(),
                toRuntimePointerTarget(target));
    }

    private boolean suppressedRepeatedHover(
            PointerAction action,
            String tool,
            PointerSample sample
    ) {
        return !operations.acceptPointerSession(
                action,
                tool,
                sample,
                presentationModel.currentInteractionState().currentProjectionLevel());
    }

    private PointerWorkflowGesture pointerWorkflowGesture(DungeonMapViewInputEvent event) {
        return new PointerWorkflowGesture(
                event.buttons().primaryButtonDown(),
                event.buttons().secondaryButtonDown(),
                event.buttons().middleButtonDown(),
                event.modifiers().shiftDown(),
                event.modifiers().controlDown(),
                controlsContentModel.wallSingleClickModeSelected());
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
            operations.selectMap(selectedMapIdValue);
        }
    }

    private void reloadSelectedMap(long selectedMapIdValue) {
        long noSelectedMapId = 0L;
        if (selectedMapIdValue > noSelectedMapId) {
            operations.selectMap(selectedMapIdValue);
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
            operations.createMap(draftName);
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
        operations.createMap(safeDraftName);
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
            operations.renameMap(mapIdValue, safeDraftName);
        }
    }

    private void deleteMap(long mapIdValue) {
        long noSelectedMapId = 0L;
        if (mapIdValue > noSelectedMapId) {
            controlsContentModel.closeMapEditor();
            operations.deleteMap(mapIdValue);
        }
    }

    private void submitRename(DungeonEditorControlsContentModel.MapEditorUiState mapEditorUiState, String draftName) {
        long mapIdValue = mapEditorUiState.mapIdValue();
        long noSelectedMapId = 0L;
        if (mapIdValue > noSelectedMapId) {
            controlsContentModel.closeMapEditor();
            operations.renameMap(mapIdValue, draftName);
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
            operations.deleteMap(mapIdValue);
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
                operations.setViewMode(normalizedViewModeKey);
            }
            return;
        }
        if (!DungeonEditorControlsContentModel.gridViewLabel().equals(selectedViewMode)) {
            operations.setViewMode(DungeonEditorControlsContentModel.gridViewLabel());
        }
    }

    private void handleToolInput(DungeonEditorControlsViewInputEvent.ToolSnapshot tool) {
        if (tool.dismissControlActivated()) {
            operations.cancelActivePreviewSession();
            return;
        }
        if (tool.selectedToolKey().isBlank()) {
            return;
        }
        DungeonEditorContributionModel.InteractionState interactionState = presentationModel.currentInteractionState();
        String selectedToolKey = tool.selectedToolKey();
        String selectedTool = DungeonEditorControlsContentModel.normalizedToolKey(selectedToolKey);
        controlsContentModel.rememberToolSelection(
                tool.requestedFamilyKey(),
                selectedTool,
                tool.selectedOptionKey());
        if (!selectedTool.equals(interactionState.currentSelectedToolKey())) {
            operations.setTool(selectedTool);
        }
    }

    private void handleOverlayInput(DungeonEditorControlsViewInputEvent.OverlaySnapshot overlay) {
        DungeonEditorPreparedFrameFacts.OverlayFrame currentOverlay =
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
        operations.setOverlay(
                        overlay.modeKey(),
                        overlay.levelRange(),
                        overlay.opacity(),
                        selectedLevels);
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
        Optional<Integer> q = parseInteger(event.corridorPointQ());
        Optional<Integer> r = parseInteger(event.corridorPointR());
        if (q.isEmpty() || r.isEmpty()) {
            return;
        }
        operations.moveStatePanelCorridorPoint(q.orElseThrow(), r.orElseThrow());
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

    private @Nullable RoomNarration toRoomNarration(
            DungeonEditorStateViewInputEvent event
    ) {
        DungeonEditorStateContentModel.RoomNarrationCardProjection card =
                stateContentModel.currentNarrationCard(event.roomId());
        if (card == null) {
            return null;
        }
        return new RoomNarration(
                card.roomId(),
                event.visualDescription(),
                narrationExits(card, event.exitDescriptions()).stream()
                        .map(DungeonEditorIntentHandler::toExitNarration)
                        .toList());
    }

    private @Nullable RoomNarrationDraftInput toRoomNarrationDraftInput(
            DungeonEditorStateViewInputEvent event
    ) {
        DungeonEditorStateContentModel.RoomNarrationCardProjection card =
                stateContentModel.currentNarrationCard(event.roomId());
        if (card == null) {
            return null;
        }
        return new RoomNarrationDraftInput(
                card.roomId(),
                event.visualDescription(),
                narrationExits(card, event.exitDescriptions()).stream()
                        .map(DungeonEditorIntentHandler::toExitNarrationDraftInput)
                        .toList());
    }

    private static List<DungeonEditorStateContentModel.RoomExitNarrationProjection> narrationExits(
            DungeonEditorStateContentModel.RoomNarrationCardProjection card,
            List<String> exitDescriptions
    ) {
        List<String> safeDescriptions = exitDescriptions == null ? List.of() : exitDescriptions;
        List<DungeonEditorStateContentModel.RoomExitNarrationProjection> exits = card.exits();
        return java.util.stream.IntStream.range(0, exits.size())
                .mapToObj(index -> {
                    DungeonEditorStateContentModel.RoomExitNarrationProjection exit = exits.get(index);
                    String description = index < safeDescriptions.size()
                            ? safeDescriptions.get(index)
                            : exit.description();
                    return exit.withDescription(description);
                })
                .toList();
    }

    private static ExitNarration toExitNarration(DungeonEditorStateContentModel.RoomExitNarrationProjection exit) {
        return new ExitNarration(
                exit.label(),
                exit.q(),
                exit.r(),
                exit.level(),
                exit.direction(),
                exit.description());
    }

    private static ExitNarrationDraftInput toExitNarrationDraftInput(
            DungeonEditorStateContentModel.RoomExitNarrationProjection exit
    ) {
        return new ExitNarrationDraftInput(
                exit.label(),
                exit.q(),
                exit.r(),
                exit.level(),
                exit.direction(),
                exit.description());
    }

    private static PointerTarget toRuntimePointerTarget(DungeonMapContentModel.PointerTarget target) {
        DungeonMapContentModel.PointerTarget safeTarget = target == null
                ? DungeonMapContentModel.PointerTarget.empty()
                : target;
        return new PointerTarget(
                safeTarget.targetKind().name(),
                safeTarget.labelKind(),
                safeTarget.elementKind(),
                safeTarget.ownerId(),
                safeTarget.clusterId(),
                safeTarget.topologyKind(),
                safeTarget.topologyId(),
                toRuntimeHandleTarget(safeTarget.handleRef()),
                toRuntimeBoundaryTarget(safeTarget.boundaryRef()));
    }

    private static HandleTarget toRuntimeHandleTarget(DungeonMapContentModel.HandleTarget handle) {
        DungeonMapContentModel.HandleTarget safeHandle = handle == null
                ? DungeonMapContentModel.HandleTarget.empty()
                : handle;
        DungeonMapContentModel.HandleTarget.SourceEdgeTarget sourceEdge = safeHandle.sourceEdgeTarget();
        return new HandleTarget(
                safeHandle.kindName(),
                safeHandle.topologyKind(),
                safeHandle.topologyId(),
                safeHandle.ownerId(),
                safeHandle.clusterId(),
                safeHandle.corridorId(),
                safeHandle.roomId(),
                safeHandle.orderIndex(),
                safeHandle.q(),
                safeHandle.r(),
                safeHandle.level(),
                safeHandle.direction(),
                sourceEdge.present(),
                sourceEdge.startQ(),
                sourceEdge.startR(),
                sourceEdge.startLevel(),
                sourceEdge.endQ(),
                sourceEdge.endR(),
                sourceEdge.endLevel());
    }

    private static BoundaryTarget toRuntimeBoundaryTarget(DungeonMapContentModel.BoundaryTarget boundary) {
        DungeonMapContentModel.BoundaryTarget safeBoundary = boundary == null
                ? DungeonMapContentModel.BoundaryTarget.empty()
                : boundary;
        return new BoundaryTarget(
                safeBoundary.kind(),
                safeBoundary.key(),
                safeBoundary.ownerId(),
                safeBoundary.topologyKind(),
                safeBoundary.topologyId(),
                safeBoundary.startQ(),
                safeBoundary.startR(),
                safeBoundary.startLevel(),
                safeBoundary.endQ(),
                safeBoundary.endR(),
                safeBoundary.endLevel());
    }

    private record LabelNameInput(String targetKind, long targetId) {

        private static LabelNameInput empty() {
            return new LabelNameInput("", 0L);
        }
    }

}
