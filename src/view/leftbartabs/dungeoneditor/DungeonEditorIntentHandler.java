package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.features.dungeon.runtime.DungeonEditorControlOperations;
import src.features.dungeon.runtime.DungeonEditorInlineLabelEditSession;
import src.features.dungeon.runtime.DungeonEditorInlineLabelOperations;
import src.features.dungeon.runtime.DungeonEditorMapCatalogOperations;
import src.features.dungeon.runtime.DungeonEditorOverlaySettings;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreparedLabelKind;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreparedTopologyKind;
import src.features.dungeon.runtime.DungeonEditorPointerInteractionOperations;
import src.features.dungeon.runtime.DungeonEditorRuntimeLabelTarget;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations;
import src.features.dungeon.runtime.DungeonEditorRuntimePointerTarget;
import src.features.dungeon.runtime.DungeonEditorStatePanelDraftOperations;
import src.features.dungeon.runtime.DungeonEditorTransitionStairOperations;
import src.features.dungeon.runtime.ExitNarration;
import src.features.dungeon.runtime.ExitNarrationDraftInput;
import src.features.dungeon.runtime.PointerAction;
import src.features.dungeon.runtime.PointerInteractionRequest;
import src.features.dungeon.runtime.PointerInteractionResult;
import src.features.dungeon.runtime.PointerInteractionTargets;
import src.features.dungeon.runtime.PointerWorkflowGesture;
import src.features.dungeon.runtime.RoomNarration;
import src.features.dungeon.runtime.RoomNarrationDraftInput;
import src.features.dungeon.runtime.StairGeometryDraftInput;
import src.features.dungeon.runtime.TransitionDestination;
import src.features.dungeon.runtime.TransitionDestinationDraftInput;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsViewInputEvent;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.InlineLabelEditCandidate;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.InlineLabelEditState;
import src.view.slotcontent.main.dungeonmap.DungeonMapViewInputEvent;

final class DungeonEditorIntentHandler {
    private static final long NO_TRANSITION_ID = 0L;

    private final DungeonEditorContributionModel presentationModel;
    private final DungeonEditorControlsContentModel controlsContentModel;
    private final CatalogCrudControlsContentModel catalogContentModel;
    private final DungeonEditorStateContentModel stateContentModel;
    private final DungeonMapContentModel mapContentModel;
    private final DungeonEditorMapCatalogOperations catalogOperations;
    private final DungeonEditorControlOperations controlOperations;
    private final DungeonEditorPointerInteractionOperations pointerOperations;
    private final DungeonEditorStatePanelDraftOperations statePanelDraftOperations;
    private final DungeonEditorInlineLabelOperations inlineLabelOperations;
    private final DungeonEditorTransitionStairOperations transitionStairOperations;
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
        DungeonEditorRuntimeOperations safeOperations = Objects.requireNonNull(operations, "operations");
        this.catalogOperations = safeOperations.catalog();
        this.controlOperations = safeOperations.controls();
        this.pointerOperations = safeOperations.pointer();
        this.statePanelDraftOperations = safeOperations.statePanelDrafts();
        this.inlineLabelOperations = safeOperations.inlineLabels();
        this.transitionStairOperations = safeOperations.transitionStairs();
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
            mapContentModel.clearHoverTarget();
            controlOperations.shiftProjectionLevel(levelShift);
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
            statePanelDraftOperations.updateStatePanelTransitionDestinationDraft(
                    TransitionDestinationDraftInput.fromExternalName(
                            new TransitionDestinationDraftInput.ExternalFields(
                                    DungeonEditorStateContentModel.transitionDestinationTypeKey(
                                            event.transitionDestinationTypeOptionIndex()),
                                    event.transitionDestinationMapId(),
                                    event.transitionDestinationTileId(),
                                    event.transitionDestinationTransitionId(),
                                    event.transitionDestinationBidirectional())));
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
        transitionStairOperations.saveTransitionLink(
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
            statePanelDraftOperations.updateStatePanelRoomNarrationDraft(draftInput);
        }
        if (!event.narrationSaveRequested()) {
            return;
        }
        RoomNarration narration = toRoomNarration(event);
        if (narration != null) {
            transitionStairOperations.saveRoomNarration(narration);
        }
    }

    private void consumeLabelNameInput(DungeonEditorStateViewInputEvent event) {
        DungeonEditorRuntimeLabelTarget target = DungeonEditorRuntimeLabelTarget.from(
                event.nameTargetKind(),
                event.nameTargetId());
        statePanelDraftOperations.updateStatePanelLabelNameDraft(
                target,
                event.labelName());
        if (!event.labelNameSaveRequested() || !target.present() || event.labelName().isBlank()) {
            return;
        }
        transitionStairOperations.saveLabelName(
                target,
                event.labelName());
    }

    private void consumeCorridorPointInput(DungeonEditorStateViewInputEvent event) {
        statePanelDraftOperations.updateStatePanelCorridorPointDraft(
                event.corridorPointQ(),
                event.corridorPointR());
        if (event.corridorPointSubmitRequested()) {
            submitCorridorPointMove(event);
        }
    }

    private void consumeTransitionDescriptionInput(
            DungeonEditorStateViewInputEvent event
    ) {
        statePanelDraftOperations.updateStatePanelTransitionDescriptionDraft(
                event.transitionId(),
                event.transitionDescription());
        if (!event.transitionDescriptionSaveRequested()) {
            return;
        }
        if (event.transitionId() > NO_TRANSITION_ID) {
            transitionStairOperations.saveTransitionDescription(
                    event.transitionId(),
                    event.transitionDescription());
        }
    }

    private void consumeStairGeometryInput(
            DungeonEditorStateViewInputEvent event
    ) {
        statePanelDraftOperations.updateStatePanelStairGeometryDraft(new StairGeometryDraftInput(
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
        transitionStairOperations.saveStairGeometry(
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
            inlineLabelOperations.cancelInlineLabelEdit();
            return true;
        }
        if (event.input().labelEditTextChanged()) {
            inlineLabelOperations.updateInlineLabelEditDraft(event.textInput());
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
            pointerOperations.clearPointerSession();
            return true;
        }
        if (event.input().mouseDragged() || event.input().mouseMoved()) {
            mapContentModel.clearHoverTarget();
            pointerOperations.clearPointerSession();
            return true;
        }
        inlineEditOutsidePressActive = false;
        return false;
    }

    private boolean consumeActiveInlineEditBoundary(DungeonMapViewInputEvent event) {
        InlineLabelEditState editState = mapContentModel.currentInlineLabelEditState();
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
            pointerOperations.clearPointerSession();
            return true;
        }
        return false;
    }

    private boolean cancelActiveInlineEdit() {
        inlineLabelOperations.cancelInlineLabelEdit();
        mapContentModel.clearHoverTarget();
        inlineEditOutsidePressActive = false;
        pointerOperations.clearPointerSession();
        return true;
    }

    private boolean consumeActiveInlineEditMousePress(DungeonMapViewInputEvent event) {
        if (event.buttons().primaryButtonDown()) {
            inlineLabelOperations.cancelInlineLabelEdit();
            inlineEditOutsidePressActive = true;
        }
        mapContentModel.clearHoverTarget();
        pointerOperations.clearPointerSession();
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
        controlOperations.cancelActivePreviewSession();
        mapContentModel.clearHoverTarget();
        return true;
    }

    private void consumePointerToolInput(DungeonMapViewInputEvent event) {
        String selectedTool = presentationModel.currentInteractionState().currentSelectedToolKey();
        PointerAction action = pointerAction(event.input());
        double sceneX = sceneX(event);
        double sceneY = sceneY(event);
        if (beginInlineLabelEdit(event, sceneX, sceneY)) {
            return;
        }
        PointerInteractionResult result = pointerOperations.applyPointerInteraction(new PointerInteractionRequest(
                action,
                selectedTool,
                pointerWorkflowGesture(event),
                pointerInteractionTargets(event, sceneX, sceneY),
                presentationModel.currentInteractionState().currentProjectionLevel(),
                transitionDestination()));
        if (!result.workflowAccepted()) {
            mapContentModel.clearHoverTarget();
            return;
        }
        updateHoverTarget(event, result.hoverTarget());
    }

    private void updateHoverTarget(
            DungeonMapViewInputEvent event,
            DungeonEditorRuntimePointerTarget pointerTarget
    ) {
        if (event.input().mouseMoved()) {
            mapContentModel.updateRuntimeHoverDisplayTarget(pointerTarget);
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

    private PointerInteractionTargets pointerInteractionTargets(
            DungeonMapViewInputEvent event,
            double sceneX,
            double sceneY
    ) {
        int projectionLevel = presentationModel.currentInteractionState().currentProjectionLevel();
        return PointerInteractionTargets.fromHitTargets(
                sceneX,
                sceneY,
                event.buttons().primaryButtonDown(),
                event.buttons().secondaryButtonDown(),
                mapContentModel.pointerHitRefsAt(sceneX, sceneY),
                mapContentModel.currentPointerTargetFrames(),
                projectionLevel);
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
                ? DungeonMapContentModel.PointerTarget.empty()
                : mapContentModel.resolveClusterLabelPointerTarget(sceneX, sceneY);
        if (!editTarget.isLabelTarget()) {
            return false;
        }
        Optional<InlineLabelEditCandidate> editCandidate =
                mapContentModel.inlineLabelEditCandidate(editTarget);
        if (editCandidate.isEmpty()) {
            return false;
        }
        inlineLabelOperations.beginInlineLabelEdit(inlineLabelEditSession(editCandidate.orElseThrow()));
        mapContentModel.clearHoverTarget();
        pointerOperations.clearPointerSession();
        return true;
    }

    private void commitInlineLabelEdit(String text) {
        inlineEditOutsidePressActive = false;
        inlineLabelOperations.commitInlineLabelEdit(text);
    }

    private static DungeonEditorInlineLabelEditSession inlineLabelEditSession(
            InlineLabelEditCandidate candidate
    ) {
        DungeonMapContentModel.PointerTarget target = candidate.target();
        DungeonEditorRuntimeLabelTarget input = inlineLabelNameInput(target);
        return DungeonEditorInlineLabelEditSession.active(
                new DungeonEditorInlineLabelEditSession.Target(
                        input,
                        inlineLabelSessionLabelKind(target.labelKind()),
                        target.ownerId(),
                        target.clusterId(),
                        inlineLabelSessionTopologyKind(target.topologyKind()),
                        target.topologyId()),
                candidate.text(),
                new DungeonEditorInlineLabelEditSession.Placement(
                        candidate.centerX(),
                        candidate.centerY(),
                        candidate.width(),
                        candidate.height(),
                        candidate.rotationDegrees()));
    }

    private static String inlineLabelSessionLabelKind(PreparedLabelKind labelKind) {
        return labelKind == null || labelKind == PreparedLabelKind.EMPTY ? "" : labelKind.name();
    }

    private static String inlineLabelSessionTopologyKind(PreparedTopologyKind topologyKind) {
        return topologyKind == null || topologyKind == PreparedTopologyKind.EMPTY ? "" : topologyKind.name();
    }

    private static DungeonEditorRuntimeLabelTarget inlineLabelNameInput(DungeonMapContentModel.PointerTarget target) {
        if (target.isClusterLabelTarget() && target.clusterId() > 0L) {
            return DungeonEditorRuntimeLabelTarget.cluster(target.clusterId());
        }
        if (target.isRoomLabelTarget() && target.topologyId() > 0L) {
            return DungeonEditorRuntimeLabelTarget.room(target.topologyId());
        }
        return DungeonEditorRuntimeLabelTarget.empty();
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

    private void handleScroll(DungeonMapViewInputEvent event) {
        if (!event.modifiers().controlDown()) {
            return;
        }
        int levelDelta = normalizeLevelDelta(event.scrollDeltaY());
        if (levelDelta != 0) {
            controlOperations.scrollSelection(levelDelta);
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
        return presentationModel.currentInteractionState().currentTransitionDestination();
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
            mapContentModel.clearHoverTarget();
            catalogOperations.selectMap(selectedMapIdValue);
        }
    }

    private void reloadSelectedMap(long selectedMapIdValue) {
        long noSelectedMapId = 0L;
        if (selectedMapIdValue > noSelectedMapId) {
            mapContentModel.clearHoverTarget();
            catalogOperations.selectMap(selectedMapIdValue);
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
            catalogOperations.createMap(draftName);
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
        catalogOperations.createMap(safeDraftName);
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
            catalogOperations.renameMap(mapIdValue, safeDraftName);
        }
    }

    private void deleteMap(long mapIdValue) {
        long noSelectedMapId = 0L;
        if (mapIdValue > noSelectedMapId) {
            controlsContentModel.closeMapEditor();
            catalogOperations.deleteMap(mapIdValue);
        }
    }

    private void submitRename(DungeonEditorControlsContentModel.MapEditorUiState mapEditorUiState, String draftName) {
        long mapIdValue = mapEditorUiState.mapIdValue();
        long noSelectedMapId = 0L;
        if (mapIdValue > noSelectedMapId) {
            controlsContentModel.closeMapEditor();
            catalogOperations.renameMap(mapIdValue, draftName);
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
            catalogOperations.deleteMap(mapIdValue);
        }
    }

    private void handleViewMode(@Nullable String viewModeKey) {
        if (viewModeKey == null || viewModeKey.isBlank()) {
            return;
        }
        var parsedViewMode = DungeonEditorControlOperations.parseViewModeKey(viewModeKey);
        if (parsedViewMode.isEmpty()) {
            return;
        }
        var viewMode = parsedViewMode.orElseThrow();
        String normalizedViewModeKey = viewMode.displayKey();
        String selectedViewMode = presentationModel.currentInteractionState().currentViewModeKey();
        if (DungeonEditorControlsContentModel.graphViewLabel().equals(normalizedViewModeKey)) {
            if (!normalizedViewModeKey.equals(selectedViewMode)) {
                mapContentModel.clearHoverTarget();
                viewMode.applyTo(controlOperations);
            }
            return;
        }
        if (!normalizedViewModeKey.equals(selectedViewMode)) {
            mapContentModel.clearHoverTarget();
            viewMode.applyTo(controlOperations);
        }
    }

    private void handleToolInput(DungeonEditorControlsViewInputEvent.ToolSnapshot tool) {
        if (tool.dismissControlActivated()) {
            controlOperations.cancelActivePreviewSession();
            return;
        }
        if (tool.selectedToolKey().isBlank()) {
            return;
        }
        DungeonEditorContributionModel.InteractionState interactionState = presentationModel.currentInteractionState();
        String selectedToolKey = tool.selectedToolKey();
        var selectedTool = DungeonEditorControlOperations.parseToolKey(selectedToolKey);
        if (selectedTool.isEmpty()) {
            return;
        }
        var selectedToolValue = selectedTool.orElseThrow();
        String selectedToolControlKey = selectedToolValue.key();
        controlsContentModel.rememberToolSelection(
                tool.requestedFamilyKey(),
                selectedToolControlKey,
                tool.selectedOptionKey());
        if (!selectedToolControlKey.equals(interactionState.currentSelectedToolKey())) {
            mapContentModel.clearHoverTarget();
            selectedToolValue.applyTo(controlOperations);
        }
    }

    private void handleOverlayInput(DungeonEditorControlsViewInputEvent.OverlaySnapshot overlay) {
        DungeonEditorPreparedFrameFacts.OverlayFrame currentOverlay =
                presentationModel.currentInteractionState().currentOverlayProjection();
        Optional<List<Integer>> parsedSelectedLevels = parseLevels(overlay.selectedLevelsText());
        if (parsedSelectedLevels.isEmpty()) {
            return;
        }
        Optional<DungeonEditorOverlaySettings.Mode> parsedOverlayMode = parseOverlayMode(overlay.modeKey());
        if (parsedOverlayMode.isEmpty()) {
            return;
        }
        DungeonEditorOverlaySettings.Mode overlayMode = parsedOverlayMode.orElseThrow();
        List<Integer> selectedLevels = parsedSelectedLevels.orElseThrow();
        List<Integer> currentSelectedLevels = parseLevels(currentOverlay.selectedLevelsText()).orElse(List.of());
        if (currentOverlay.modeKey().equals(overlayMode.name())
                && currentOverlay.levelRange() == overlay.levelRange()
                && Double.compare(currentOverlay.opacity(), overlay.opacity()) == 0
                && currentSelectedLevels.equals(selectedLevels)) {
            return;
        }
        controlOperations.setOverlay(new DungeonEditorOverlaySettings(
                overlayMode,
                overlay.levelRange(),
                overlay.opacity(),
                selectedLevels));
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
        statePanelDraftOperations.moveStatePanelCorridorPoint(q.orElseThrow(), r.orElseThrow());
    }

    private static Optional<DungeonEditorOverlaySettings.Mode> parseOverlayMode(@Nullable String modeKey) {
        if (modeKey == null || modeKey.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(DungeonEditorOverlaySettings.Mode.valueOf(modeKey.strip()));
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }
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
        return presentationModel.currentInteractionState().currentSelectedTransitionId();
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

}
