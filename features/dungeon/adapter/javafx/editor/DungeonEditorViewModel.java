package features.dungeon.adapter.javafx.editor;

import java.util.List;
import java.util.Objects;
import javafx.beans.property.ReadOnlyObjectWrapper;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.api.DungeonMapId;
import features.dungeon.api.editor.DungeonEditorApi;
import features.dungeon.api.editor.DungeonEditorIntent;
import features.dungeon.api.editor.DungeonEditorPointerGesture;
import features.dungeon.api.editor.DungeonEditorPointerInput;
import features.dungeon.api.editor.DungeonEditorState;
import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.api.editor.DungeonEditorToolOptions;
import features.dungeon.api.editor.DungeonEditorToolSelection;
import platform.ui.catalogcrud.CatalogCrudControlsContentModel;
import platform.ui.catalogcrud.CatalogCrudControlsViewInputEvent;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.InlineLabelEditCandidate;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.InlineLabelEditState;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.PointerTarget;
import features.dungeon.adapter.javafx.map.DungeonMapViewInputEvent;

final class DungeonEditorViewModel {
    private static final long NO_TRANSITION_ID = 0L;
    private static final String UNDO_COMMAND = "UNDO";
    private static final String REDO_COMMAND = "REDO";

    private final ReadOnlyObjectWrapper<ControlsProjection> controlsProjection =
            new ReadOnlyObjectWrapper<>(ControlsProjection.initial());
    private final DungeonEditorControlsPanelModel controlsPanelModel;
    private final CatalogCrudControlsContentModel catalogContentModel;
    private final DungeonEditorStatePanelModel statePanelModel;
    private final DungeonMapContentModel mapContentModel;
    private final DungeonEditorApi editorApi;
    private double lastCameraDragCanvasX;
    private double lastCameraDragCanvasY;
    private boolean cameraDragActive;
    private boolean inlineEditOutsidePressActive;
    private DungeonEditorState latestEditorState = DungeonEditorState.empty();
    private InteractionState interactionState = InteractionState.empty();

    DungeonEditorViewModel(
            DungeonEditorControlsPanelModel controlsPanelModel,
            DungeonEditorStatePanelModel statePanelModel,
            CatalogCrudControlsContentModel catalogContentModel,
            DungeonMapContentModel mapContentModel,
            DungeonEditorApi editorApi
    ) {
        this.controlsPanelModel = Objects.requireNonNull(controlsPanelModel, "controlsPanelModel");
        this.catalogContentModel = Objects.requireNonNull(catalogContentModel, "catalogContentModel");
        this.statePanelModel = Objects.requireNonNull(statePanelModel, "statePanelModel");
        this.mapContentModel = Objects.requireNonNull(mapContentModel, "mapContentModel");
        this.editorApi = Objects.requireNonNull(editorApi, "editorApi");
    }



    void bindPanelModels() {
        controlsProjection.addListener((ignored, before, after) -> {
            applyControlsProjection(after, controlsPanelModel);
            applyMapCatalogProjection(after, controlsPanelModel.currentMapEditorUiState(), catalogContentModel);
        });
        controlsPanelModel.mapEditorProperty().addListener((ignored, before, after) ->
                applyMapCatalogProjection(controlsProjection.get(), after, catalogContentModel));
        applyControlsProjection(controlsProjection.get(), controlsPanelModel);
        applyMapCatalogProjection(
                controlsProjection.get(),
                controlsPanelModel.currentMapEditorUiState(),
                catalogContentModel);
    }

    void applyState(DungeonEditorState state) {
        DungeonEditorState safeState = state == null ? DungeonEditorState.empty() : state;
        boolean localEditContextChanged = !Objects.equals(
                        latestEditorState.selectedMapId(), safeState.selectedMapId())
                || latestEditorState.viewMode() != safeState.viewMode()
                || latestEditorState.projectionLevel() != safeState.projectionLevel();
        if (localEditContextChanged) {
            mapContentModel.cancelInlineLabelEdit();
            inlineEditOutsidePressActive = false;
        }
        latestEditorState = safeState;
        interactionState = InteractionState.from(safeState);
        controlsProjection.set(ControlsProjection.from(safeState));
        statePanelModel.apply(safeState);
        mapContentModel.applyEditorState(safeState);
    }

    private InteractionState currentInteractionState() {
        return interactionState;
    }

    private static void applyControlsProjection(
            ControlsProjection projection,
            DungeonEditorControlsPanelModel panelModel
    ) {
        ControlsProjection safeProjection = projection == null
                ? ControlsProjection.initial()
                : projection;
        panelModel.showControls(
                safeProjection.mapEntries().stream()
                        .map(entry -> new DungeonEditorControlsPanelModel.MapItem(
                                entry.key(),
                                entry.mapIdValue(),
                                entry.mapName(),
                                entry.revision()))
                        .toList(),
                safeProjection.selectedMapKey(),
                safeProjection.reachableLevels(),
                safeProjection.busy(),
                safeProjection.statusText(),
                safeProjection.viewModeLabel(),
                safeProjection.overlaySettings(),
                safeProjection.projectionLevel(),
                safeProjection.toolSelection());
    }

    private static void applyMapCatalogProjection(
            ControlsProjection projection,
            DungeonEditorControlsPanelModel.MapEditorUiState mapEditor,
            CatalogCrudControlsContentModel catalogContentModel
    ) {
        ControlsProjection safeProjection = projection == null
                ? ControlsProjection.initial()
                : projection;
        catalogContentModel.showCatalog(new CatalogCrudControlsContentModel.CatalogState(
                "Dungeon Maps",
                "Dungeon auswählen",
                "Keine Dungeon Maps verfuegbar.",
                safeProjection.selectedMapKey(),
                safeProjection.mapEntries().stream()
                        .map(DungeonEditorViewModel::toCatalogItem)
                        .toList(),
                new CatalogCrudControlsContentModel.Actions(true, true, true, true),
                safeProjection.busy(),
                safeProjection.statusText()));
        applyCatalogEditorState(mapEditor, catalogContentModel);
    }

    private static CatalogCrudControlsContentModel.Item toCatalogItem(MapListEntry entry) {
        return new CatalogCrudControlsContentModel.Item(
                Long.toString(entry.mapIdValue()),
                entry.mapName(),
                "",
                0L,
                true);
    }

    private static void applyCatalogEditorState(
            DungeonEditorControlsPanelModel.MapEditorUiState mapEditor,
            CatalogCrudControlsContentModel catalogContentModel
    ) {
        DungeonEditorControlsPanelModel.MapEditorUiState safeEditor =
                DungeonEditorControlsPanelModel.MapEditorUiState.resolve(mapEditor);
        if (!safeEditor.visible()) {
            catalogContentModel.closeOperation();
            return;
        }
        if (safeEditor.isCreateMode()) {
            catalogContentModel.openCreate();
        } else if (safeEditor.isRenameMode()) {
            catalogContentModel.openRename(Long.toString(safeEditor.mapIdValue()));
        } else if (safeEditor.isDeleteMode()) {
            catalogContentModel.openDelete(Long.toString(safeEditor.mapIdValue()));
        }
        catalogContentModel.updateDraft(safeEditor.draftName());
        catalogContentModel.showValidationError(safeEditor.errorText());
    }

    void consume(DungeonMapViewInputEvent event) {
        if (event != null) {
            consumeMapCanvas(event);
        }
    }

    void consume(DungeonEditorControlsInput event) {
        DungeonEditorControlsInput safeEvent = event == null
                ? DungeonEditorControlsInput.none()
                : event;
        DungeonEditorControlsInput.MapInput map = safeEvent.map();
        DungeonEditorControlsInput.ProjectionInput projection = safeEvent.projection();
        DungeonEditorControlsInput.ToolInput tool = safeEvent.tool();
        DungeonEditorControlsInput.OverlayInput overlay = safeEvent.overlay();
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
            handleViewMode(projection);
            return;
        }
        if (hasToolInput(tool)) {
            handleToolInput(tool);
            return;
        }
        int levelShift = projection.levelShift();
        if (levelShift != 0) {
            mapContentModel.clearHoverTarget();
            editorApi.dispatch(new DungeonEditorIntent.ShiftProjectionLevel(levelShift));
            return;
        }
        if (overlay.mode() != null) {
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
            controlsPanelModel.openCreateMapEditor();
            return;
        }
        if (!event.renameEditorItemId().isBlank()) {
            catalogContentModel.openRename(event.renameEditorItemId());
            controlsPanelModel.openSelectedMapEditor(
                    DungeonEditorControlsPanelModel.MapEditorMode.RENAME,
                    parseLongOrZero(event.renameEditorItemId()));
            return;
        }
        if (!event.deleteRequestItemId().isBlank()) {
            catalogContentModel.openDelete(event.deleteRequestItemId());
            controlsPanelModel.openSelectedMapEditor(
                    DungeonEditorControlsPanelModel.MapEditorMode.DELETE,
                    parseLongOrZero(event.deleteRequestItemId()));
            return;
        }
        if (event.dismissed()) {
            catalogContentModel.closeOperation();
            controlsPanelModel.closeMapEditor();
        }
    }

    void consume(DungeonEditorStateInput event) {
        if (event == null) {
            return;
        }
        consumeLabelNameWhenPresent(event.labelName());
        consumeNarrationWhenPresent(event.narration());
        consumeCorridorPointWhenPresent(event.corridorPoint());
        consumeTransitionDestinationWhenPresent(event.transitionDestination());
        consumeTransitionDescriptionWhenPresent(event.transitionDescription());
        consumeStairGeometryWhenPresent(event.stairGeometry());
        consumeFeatureMarkerSemanticsWhenPresent(event.featureMarkerSemantics());
    }

    private void consumeNarrationWhenPresent(DungeonEditorStateInput.NarrationInput input) {
        if (input.roomId() > 0L || input.saveRequested()) {
            consumeNarrationInput(input);
        }
    }

    private void consumeLabelNameWhenPresent(DungeonEditorStateInput.LabelNameInput input) {
        if (input.inputObserved() || input.saveRequested()) {
            consumeLabelNameInput(input);
        }
    }

    private void consumeCorridorPointWhenPresent(DungeonEditorStateInput.CorridorPointInput input) {
        if (input.inputObserved() || input.submitRequested()) {
            consumeCorridorPointInput(input);
        }
    }

    private void consumeTransitionDescriptionWhenPresent(DungeonEditorStateInput.TransitionDescriptionInput input) {
        if (input.inputObserved() || input.saveRequested()) {
            consumeTransitionDescriptionInput(input);
        }
    }

    private void consumeTransitionDestinationWhenPresent(DungeonEditorStateInput.TransitionDestinationInput input) {
        if (input.inputObserved()) {
            DungeonEditorIntent.TransitionDestinationInput draftInput = transitionDestinationDraftInput(input);
            editorApi.dispatch(new DungeonEditorIntent.UpdateTransitionDestination(draftInput));
            if (input.saveRequested()) {
                consumeTransitionLinkSave(draftInput);
            }
        }
    }

    private void consumeTransitionLinkSave(DungeonEditorIntent.TransitionDestinationInput input) {
        long sourceTransitionId = selectedTransitionId();
        if (sourceTransitionId <= NO_TRANSITION_ID) {
            return;
        }
        editorApi.dispatch(new DungeonEditorIntent.CommitTransitionDestination(sourceTransitionId, input));
    }

    private void consumeStairGeometryWhenPresent(DungeonEditorStateInput.StairGeometryInput input) {
        if (input.inputObserved() || input.saveRequested()) {
            consumeStairGeometryInput(input);
        }
    }

    private void consumeFeatureMarkerSemanticsWhenPresent(
            DungeonEditorStateInput.FeatureMarkerSemanticsInput input
    ) {
        if (input.markerId() <= 0L || input.label().isBlank()) {
            return;
        }
        editorApi.dispatch(new DungeonEditorIntent.CommitFeatureMarkerSemantics(
                input.markerId(), input.label(), input.description()));
    }

    private void consumeNarrationInput(DungeonEditorStateInput.NarrationInput input) {
        DungeonEditorIntent.RoomNarrationInput draftInput = toRoomNarrationInput(input);
        if (draftInput != null) {
            editorApi.dispatch(new DungeonEditorIntent.UpdateRoomNarration(draftInput));
        }
        if (!input.saveRequested()) {
            return;
        }
        DungeonEditorIntent.RoomNarrationInput narration = toRoomNarrationInput(input);
        if (narration != null) {
            editorApi.dispatch(new DungeonEditorIntent.CommitRoomNarration(narration));
        }
    }

    private void consumeLabelNameInput(DungeonEditorStateInput.LabelNameInput input) {
        DungeonEditorIntent.LabelTarget target = apiLabelTarget(statePanelModel.currentLabelNameTarget());
        editorApi.dispatch(new DungeonEditorIntent.UpdateLabelName(target, input.name()));
        if (!input.saveRequested()
                || target.kind() == DungeonEditorIntent.LabelTargetKind.EMPTY
                || input.name().isBlank()) {
            return;
        }
        editorApi.dispatch(new DungeonEditorIntent.CommitLabelName(target, input.name()));
    }

    private static DungeonEditorIntent.LabelTarget apiLabelTarget(
            DungeonEditorStatePanelModel.LabelNameTarget target
    ) {
        DungeonEditorStatePanelModel.LabelNameTarget safeTarget = target == null
                ? DungeonEditorStatePanelModel.LabelNameTarget.empty()
                : target;
        return switch (safeTarget.kind()) {
            case ROOM -> new DungeonEditorIntent.LabelTarget(
                    DungeonEditorIntent.LabelTargetKind.ROOM, safeTarget.id());
            case CLUSTER -> new DungeonEditorIntent.LabelTarget(
                    DungeonEditorIntent.LabelTargetKind.CLUSTER, safeTarget.id());
            case EMPTY -> DungeonEditorIntent.LabelTarget.empty();
        };
    }

    private void consumeCorridorPointInput(DungeonEditorStateInput.CorridorPointInput input) {
        editorApi.dispatch(new DungeonEditorIntent.UpdateCorridorPoint(input.q(), input.r()));
        if (input.submitRequested()) {
            submitCorridorPointMove(input);
        }
    }

    private void consumeTransitionDescriptionInput(
            DungeonEditorStateInput.TransitionDescriptionInput input
    ) {
        editorApi.dispatch(new DungeonEditorIntent.UpdateTransitionDescription(
                input.transitionId(), input.description()));
        if (!input.saveRequested()) {
            return;
        }
        if (input.transitionId() > NO_TRANSITION_ID) {
            editorApi.dispatch(new DungeonEditorIntent.CommitTransitionDescription(
                    input.transitionId(), input.description()));
        }
    }

    private void consumeStairGeometryInput(
            DungeonEditorStateInput.StairGeometryInput input
    ) {
        DungeonEditorIntent.StairGeometryInput draftInput = stairGeometryInput(input);
        editorApi.dispatch(new DungeonEditorIntent.UpdateStairGeometry(draftInput));
        if (!input.saveRequested()) {
            return;
        }
        if (!completeForSave(draftInput)) {
            return;
        }
        editorApi.dispatch(new DungeonEditorIntent.CommitStairGeometry(draftInput));
    }

    private static DungeonEditorIntent.TransitionDestinationInput transitionDestinationDraftInput(
            DungeonEditorStateInput.TransitionDestinationInput input
    ) {
        return new DungeonEditorIntent.TransitionDestinationInput(
                DungeonEditorStatePanelModel.transitionDestinationTypeKey(input.destination().optionIndex()),
                input.mapId(),
                input.tileId(),
                input.transitionId(),
                input.bidirectional());
    }

    private static DungeonEditorIntent.StairGeometryInput stairGeometryInput(
            DungeonEditorStateInput.StairGeometryInput input
    ) {
        return new DungeonEditorIntent.StairGeometryInput(
                input.stairId(),
                input.shape().externalName(),
                input.direction().externalName(),
                input.dimension1(),
                input.dimension2());
    }

    private static boolean completeForSave(DungeonEditorIntent.StairGeometryInput input) {
        return input.stairId() > 0L
                && parseInteger(input.dimension1()).isPresent()
                && parseInteger(input.dimension2()).isPresent();
    }

    private void consumeMapCanvas(DungeonMapViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (consumeInlineLabelEditEvent(event) || consumeHistoryCommand(event)
                || consumeInlineEditOutsidePressGesture(event)
                || consumeActiveInlineEditBoundary(event)
                || consumeLocalCameraInput(event) || consumeScrollInput(event) || consumeEscapeInput(event)) {
            return;
        }
        consumePointerToolInput(event);
    }

    private boolean consumeHistoryCommand(DungeonMapViewInputEvent event) {
        if (!event.input().escapePressed()) {
            return false;
        }
        if (UNDO_COMMAND.equals(event.textInput())) {
            mapContentModel.clearHoverTarget();
            editorApi.dispatch(DungeonEditorIntent.Undo.INSTANCE);
            return true;
        }
        if (REDO_COMMAND.equals(event.textInput())) {
            mapContentModel.clearHoverTarget();
            editorApi.dispatch(DungeonEditorIntent.Redo.INSTANCE);
            return true;
        }
        return false;
    }

    private boolean consumeInlineLabelEditEvent(DungeonMapViewInputEvent event) {
        if (event.input().labelEditCommitted()) {
            inlineEditOutsidePressActive = false;
            commitInlineLabelEdit(event.textInput());
            return true;
        }
        if (event.input().labelEditCancelled()) {
            inlineEditOutsidePressActive = false;
            mapContentModel.cancelInlineLabelEdit();
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
            mapContentModel.clearHoverTarget();
            inlineEditOutsidePressActive = false;
            editorApi.dispatch(DungeonEditorIntent.ClearPointerSession.INSTANCE);
            return true;
        }
        if (event.input().mouseDragged() || event.input().mouseMoved()) {
            mapContentModel.clearHoverTarget();
            editorApi.dispatch(DungeonEditorIntent.ClearPointerSession.INSTANCE);
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
            editorApi.dispatch(DungeonEditorIntent.ClearPointerSession.INSTANCE);
            return true;
        }
        return false;
    }

    private boolean cancelActiveInlineEdit() {
        mapContentModel.cancelInlineLabelEdit();
        mapContentModel.clearHoverTarget();
        inlineEditOutsidePressActive = false;
        editorApi.dispatch(DungeonEditorIntent.ClearPointerSession.INSTANCE);
        return true;
    }

    private boolean consumeActiveInlineEditMousePress(DungeonMapViewInputEvent event) {
        if (event.buttons().primaryButtonDown()) {
            mapContentModel.cancelInlineLabelEdit();
            inlineEditOutsidePressActive = true;
        }
        mapContentModel.clearHoverTarget();
        editorApi.dispatch(DungeonEditorIntent.ClearPointerSession.INSTANCE);
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
        editorApi.dispatch(DungeonEditorIntent.CancelPreview.INSTANCE);
        mapContentModel.clearHoverTarget();
        return true;
    }

    private void consumePointerToolInput(DungeonMapViewInputEvent event) {
        DungeonEditorToolSelection toolSelection = currentInteractionState().currentToolSelection();
        DungeonEditorPointerInput.Action action = pointerAction(event.input());
        double sceneX = sceneX(event);
        double sceneY = sceneY(event);
        if (beginInlineLabelEdit(event, sceneX, sceneY)) {
            return;
        }
        List<PointerTarget> targets = pointerTargets(sceneX, sceneY);
        editorApi.dispatch(new DungeonEditorIntent.Pointer(new DungeonEditorPointerInput(
                latestEditorState.publicationRevision(),
                action,
                toolSelection,
                pointerWorkflowGesture(event),
                sceneX,
                sceneY,
                targets.stream().map(DungeonEditorViewModel::apiPointerTarget).toList(),
                currentInteractionState().currentProjectionLevel(),
                transitionDestination())));
        updateHoverTarget(event, hoverTarget(toolSelection, event, targets, sceneX, sceneY));
    }

    private void updateHoverTarget(
            DungeonMapViewInputEvent event,
            PointerTarget pointerTarget
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

    private List<PointerTarget> pointerTargets(double sceneX, double sceneY) {
        return mapContentModel.pointerTargetsAt(sceneX, sceneY);
    }

    private PointerTarget primaryTarget(List<PointerTarget> targets, double sceneX, double sceneY) {
        PointerTarget bestTarget = PointerTarget.empty();
        int bestPriority = Integer.MAX_VALUE;
        double bestBoundaryDistance = Double.POSITIVE_INFINITY;
        for (PointerTarget candidate : targets == null ? List.<PointerTarget>of() : targets) {
            int candidatePriority = pointerTargetPriority(candidate);
            double candidateBoundaryDistance = candidate.boundaryDistanceTo(sceneX, sceneY);
            if (candidatePriority < bestPriority
                    || candidatePriority == bestPriority
                    && candidate.isBoundaryTarget()
                    && bestTarget.isBoundaryTarget()
                    && (candidateBoundaryDistance < bestBoundaryDistance
                    || candidateBoundaryDistance == bestBoundaryDistance
                    && candidate.boundaryTieBreakKey().compareTo(bestTarget.boundaryTieBreakKey()) < 0)) {
                bestTarget = candidate;
                bestPriority = candidatePriority;
                bestBoundaryDistance = candidateBoundaryDistance;
            }
        }
        return bestTarget;
    }

    private PointerTarget hoverTarget(
            DungeonEditorToolSelection toolSelection,
            DungeonMapViewInputEvent event,
            List<PointerTarget> targets,
            double sceneX,
            double sceneY
    ) {
        PointerTarget primary = primaryTarget(targets, sceneX, sceneY);
        DungeonEditorToolFamily family = toolSelection == null
                ? DungeonEditorToolFamily.SELECT
                : toolSelection.family();
        if (event.buttons().secondaryButtonDown() && event.modifiers().shiftDown()
                && family != DungeonEditorToolFamily.WALL) {
            return PointerTarget.empty();
        }
        if (family == DungeonEditorToolFamily.SELECT) {
            return primary.selectableBySelectTool() ? primary : PointerTarget.empty();
        }
        if (family == DungeonEditorToolFamily.ROOM) {
            return mapContentModel.syntheticHoverTarget(
                    toolSelection, false, sceneX, sceneY, currentInteractionState().currentProjectionLevel());
        }
        if (family == DungeonEditorToolFamily.WALL) {
            boolean singleClick = event.modifiers().controlDown()
                    || toolSelection.options() instanceof DungeonEditorToolOptions.Wall wall
                    && wall.mode() == DungeonEditorToolOptions.Wall.Mode.SINGLE;
            if (singleClick && primary.isBoundaryTarget()) {
                return primary;
            }
            return mapContentModel.syntheticHoverTarget(
                    toolSelection, singleClick, sceneX, sceneY, currentInteractionState().currentProjectionLevel());
        }
        if (family == DungeonEditorToolFamily.DOOR) {
            PointerTarget boundary = boundaryPreferredTarget(targets, sceneX, sceneY);
            return boundary.isBoundaryTarget() ? boundary : PointerTarget.empty();
        }
        if (family == DungeonEditorToolFamily.CORRIDOR) {
            PointerTarget boundaryPreferred = boundaryPreferredTarget(targets, sceneX, sceneY);
            return boundaryPreferred.isWallOrDoorBoundaryTarget() || boundaryPreferred.isCorridorCellTarget()
                    ? boundaryPreferred
                    : PointerTarget.empty();
        }
        return primary;
    }

    private static PointerTarget boundaryPreferredTarget(
            List<PointerTarget> targets,
            double sceneX,
            double sceneY
    ) {
        PointerTarget bestBoundary = PointerTarget.empty();
        double bestDistance = Double.POSITIVE_INFINITY;
        for (PointerTarget target : targets == null ? List.<PointerTarget>of() : targets) {
            if (!target.isBoundaryTarget()) {
                continue;
            }
            double distance = target.boundaryDistanceTo(sceneX, sceneY);
            if (distance < bestDistance
                    || distance == bestDistance
                    && target.boundaryTieBreakKey().compareTo(bestBoundary.boundaryTieBreakKey()) < 0) {
                bestBoundary = target;
                bestDistance = distance;
            }
        }
        return bestBoundary.isEmptyTarget()
                ? primaryTargetWithoutBoundaryPreference(targets, sceneX, sceneY)
                : bestBoundary;
    }

    private static PointerTarget primaryTargetWithoutBoundaryPreference(
            List<PointerTarget> targets,
            double sceneX,
            double sceneY
    ) {
        PointerTarget bestTarget = PointerTarget.empty();
        int bestPriority = Integer.MAX_VALUE;
        double bestBoundaryDistance = Double.POSITIVE_INFINITY;
        for (PointerTarget candidate : targets == null ? List.<PointerTarget>of() : targets) {
            int candidatePriority = pointerTargetPriority(candidate);
            double candidateBoundaryDistance = candidate.boundaryDistanceTo(sceneX, sceneY);
            if (candidatePriority < bestPriority
                    || candidatePriority == bestPriority
                    && candidate.isBoundaryTarget()
                    && bestTarget.isBoundaryTarget()
                    && (candidateBoundaryDistance < bestBoundaryDistance
                    || candidateBoundaryDistance == bestBoundaryDistance
                    && candidate.boundaryTieBreakKey().compareTo(bestTarget.boundaryTieBreakKey()) < 0)) {
                bestTarget = candidate;
                bestPriority = candidatePriority;
                bestBoundaryDistance = candidateBoundaryDistance;
            }
        }
        return bestTarget;
    }

    private static int pointerTargetPriority(PointerTarget target) {
        PointerTarget safeTarget = target == null ? PointerTarget.empty() : target;
        if (safeTarget.isLabelTarget()) {
            return safeTarget.isClusterLabelTarget() ? 1 : safeTarget.isRoomLabelTarget() ? 2 : 6;
        }
        if (safeTarget.isHandleTarget()) {
            return 0;
        }
        if (safeTarget.isMarkerTarget()) {
            return safeTarget.hasTransitionElement() ? -1 : 2;
        }
        if (safeTarget.isCellTarget()) {
            if (safeTarget.hasTransitionElement()) {
                return 0;
            }
            if (safeTarget.hasRoomElement()) {
                return 4;
            }
            return safeTarget.hasFeatureMarkerElement() ? 5 : 6;
        }
        if (safeTarget.isBoundaryTarget()) {
            return 3;
        }
        return safeTarget.isGraphNodeTarget() ? 7 : Integer.MAX_VALUE;
    }

    private static DungeonEditorPointerInput.Target apiPointerTarget(PointerTarget target) {
        return target == null
                ? DungeonEditorPointerInput.Target.empty()
                : target.toApiTarget();
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
        PointerTarget editTarget = event.modifiers().shiftDown()
                ? PointerTarget.empty()
                : primaryTarget(pointerTargets(sceneX, sceneY), sceneX, sceneY);
        if (!editTarget.isLabelTarget()) {
            return false;
        }
        Optional<InlineLabelEditCandidate> editCandidate =
                mapContentModel.inlineLabelEditCandidate(editTarget);
        if (editCandidate.isEmpty()) {
            return false;
        }
        mapContentModel.beginInlineLabelEdit(editTarget, editCandidate.orElseThrow());
        mapContentModel.clearHoverTarget();
        editorApi.dispatch(DungeonEditorIntent.ClearPointerSession.INSTANCE);
        return true;
    }

    private void commitInlineLabelEdit(String text) {
        inlineEditOutsidePressActive = false;
        InlineLabelEditState editState = mapContentModel.currentInlineLabelEditState();
        if (editState != null && editState.active()) {
            DungeonEditorIntent.LabelTarget target = apiLabelTarget(editState.target());
            mapContentModel.cancelInlineLabelEdit();
            if (target.kind() != DungeonEditorIntent.LabelTargetKind.EMPTY && !text.isBlank()) {
                editorApi.dispatch(new DungeonEditorIntent.CommitLabelName(target, text));
            }
        }
    }

    private static DungeonEditorIntent.LabelTarget apiLabelTarget(PointerTarget target) {
        PointerTarget safeTarget = target == null ? PointerTarget.empty() : target;
        if ("ROOM_LABEL".equals(safeTarget.labelKindKey())) {
            return new DungeonEditorIntent.LabelTarget(
                    DungeonEditorIntent.LabelTargetKind.ROOM, safeTarget.ownerId());
        }
        if ("CLUSTER_LABEL".equals(safeTarget.labelKindKey())) {
            return new DungeonEditorIntent.LabelTarget(
                    DungeonEditorIntent.LabelTargetKind.CLUSTER, safeTarget.ownerId());
        }
        return DungeonEditorIntent.LabelTarget.empty();
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
            editorApi.dispatch(new DungeonEditorIntent.ScrollSelection(levelDelta));
        }
    }

    private static DungeonEditorPointerInput.Action pointerAction(DungeonMapViewInputEvent.CanvasInput input) {
        if (input.mousePressed()) {
            return DungeonEditorPointerInput.Action.PRESSED;
        }
        if (input.mouseDragged()) {
            return DungeonEditorPointerInput.Action.DRAGGED;
        }
        if (input.mouseReleased()) {
            return DungeonEditorPointerInput.Action.RELEASED;
        }
        if (input.mouseMoved()) {
            return DungeonEditorPointerInput.Action.MOVED;
        }
        return DungeonEditorPointerInput.Action.MOVED;
    }

    private DungeonEditorIntent.TransitionDestinationInput transitionDestination() {
        return currentInteractionState().currentTransitionDestination();
    }

    private static DungeonEditorPointerGesture pointerWorkflowGesture(DungeonMapViewInputEvent event) {
        DungeonEditorPointerGesture.Button button = event.buttons().primaryButtonDown()
                ? DungeonEditorPointerGesture.Button.PRIMARY
                : event.buttons().secondaryButtonDown()
                ? DungeonEditorPointerGesture.Button.SECONDARY
                : event.buttons().middleButtonDown()
                ? DungeonEditorPointerGesture.Button.MIDDLE
                : DungeonEditorPointerGesture.Button.NONE;
        return new DungeonEditorPointerGesture(
                button,
                event.modifiers().shiftDown(),
                event.modifiers().controlDown());
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
        InteractionState interactionState = currentInteractionState();
        long noSelectedMapId = 0L;
        if (selectedMapIdValue > noSelectedMapId
            && selectedMapIdValue != interactionState.currentSelectedMapIdValue()) {
            mapContentModel.clearHoverTarget();
            editorApi.dispatch(new DungeonEditorIntent.SelectMap(new DungeonMapId(selectedMapIdValue)));
        }
    }

    private void reloadSelectedMap(long selectedMapIdValue) {
        long noSelectedMapId = 0L;
        if (selectedMapIdValue > noSelectedMapId) {
            mapContentModel.clearHoverTarget();
            editorApi.dispatch(new DungeonEditorIntent.SelectMap(new DungeonMapId(selectedMapIdValue)));
        }
    }

    private void handleMapEditor(DungeonEditorControlsInput.MapInput map) {
        controlsPanelModel.updateMapEditorDraft(map.editorDraftName());
        InteractionState interactionState = currentInteractionState();
        if (map.dismissControlActivated()) {
            controlsPanelModel.closeMapEditor();
            return;
        }
        if (map.createControlActivated()) {
            controlsPanelModel.openCreateMapEditor();
            return;
        }
        if (map.renameControlActivated()) {
            controlsPanelModel.openSelectedMapEditor(
                    DungeonEditorControlsPanelModel.MapEditorMode.RENAME,
                    interactionState.currentSelectedMapIdValue());
            return;
        }
        if (map.deleteControlActivated()) {
            controlsPanelModel.openSelectedMapEditor(
                    DungeonEditorControlsPanelModel.MapEditorMode.DELETE,
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
        DungeonEditorControlsPanelModel.MapEditorUiState mapEditorUiState =
                controlsPanelModel.currentMapEditorUiState();
        String draftName = mapEditorUiState.draftName().strip();
        if (draftName.isBlank()) {
            controlsPanelModel.showMapEditorValidationError("Name fehlt.");
            return;
        }
        if (mapEditorUiState.isCreateMode()) {
            controlsPanelModel.closeMapEditor();
            editorApi.dispatch(new DungeonEditorIntent.CreateMap(draftName));
            return;
        }
        if (mapEditorUiState.isRenameMode()) {
            submitRename(mapEditorUiState, draftName);
        }
    }

    private void createMap(String draftName) {
        String safeDraftName = draftName == null ? "" : draftName.strip();
        if (safeDraftName.isBlank()) {
            controlsPanelModel.showMapEditorValidationError("Name fehlt.");
            return;
        }
        controlsPanelModel.closeMapEditor();
        editorApi.dispatch(new DungeonEditorIntent.CreateMap(safeDraftName));
    }

    private void renameMap(long mapIdValue, String draftName) {
        String safeDraftName = draftName == null ? "" : draftName.strip();
        if (safeDraftName.isBlank()) {
            controlsPanelModel.showMapEditorValidationError("Name fehlt.");
            return;
        }
        long noSelectedMapId = 0L;
        if (mapIdValue > noSelectedMapId) {
            controlsPanelModel.closeMapEditor();
            editorApi.dispatch(new DungeonEditorIntent.RenameMap(
                    new DungeonMapId(mapIdValue), safeDraftName));
        }
    }

    private void deleteMap(long mapIdValue) {
        long noSelectedMapId = 0L;
        if (mapIdValue > noSelectedMapId) {
            controlsPanelModel.closeMapEditor();
            editorApi.dispatch(new DungeonEditorIntent.DeleteMap(new DungeonMapId(mapIdValue)));
        }
    }

    private void submitRename(DungeonEditorControlsPanelModel.MapEditorUiState mapEditorUiState, String draftName) {
        long mapIdValue = mapEditorUiState.mapIdValue();
        long noSelectedMapId = 0L;
        if (mapIdValue > noSelectedMapId) {
            controlsPanelModel.closeMapEditor();
            editorApi.dispatch(new DungeonEditorIntent.RenameMap(
                    new DungeonMapId(mapIdValue), draftName));
        }
    }

    private void handleMapDelete() {
        DungeonEditorControlsPanelModel.MapEditorUiState mapEditorUiState =
                controlsPanelModel.currentMapEditorUiState();
        if (!mapEditorUiState.isDeleteMode()) {
            return;
        }
        long mapIdValue = mapEditorUiState.mapIdValue();
        long noSelectedMapId = 0L;
        if (mapIdValue > noSelectedMapId) {
            controlsPanelModel.closeMapEditor();
            editorApi.dispatch(new DungeonEditorIntent.DeleteMap(new DungeonMapId(mapIdValue)));
        }
    }

    private void handleViewMode(DungeonEditorControlsInput.ProjectionInput projection) {
        if (projection.viewMode() == null) {
            return;
        }
        String normalizedViewModeKey = projection.viewModeKey();
        String selectedViewMode = currentInteractionState().currentViewModeKey();
        if (DungeonEditorControlsPanelModel.graphViewLabel().equals(normalizedViewModeKey)) {
            if (!normalizedViewModeKey.equals(selectedViewMode)) {
                mapContentModel.clearHoverTarget();
                editorApi.dispatch(new DungeonEditorIntent.SetViewMode(projection.viewMode()));
            }
            return;
        }
        if (!normalizedViewModeKey.equals(selectedViewMode)) {
            mapContentModel.clearHoverTarget();
            editorApi.dispatch(new DungeonEditorIntent.SetViewMode(projection.viewMode()));
        }
    }

    private void handleToolInput(DungeonEditorControlsInput.ToolInput tool) {
        if (tool.dismissControlActivated()) {
            editorApi.dispatch(DungeonEditorIntent.CancelPreview.INSTANCE);
            return;
        }
        if (tool.selection() == null) {
            return;
        }
        InteractionState interactionState = currentInteractionState();
        DungeonEditorToolSelection selection = tool.selection();
        controlsPanelModel.rememberToolSelection(selection);
        if (!selection.equals(interactionState.currentToolSelection())) {
            mapContentModel.clearHoverTarget();
            editorApi.dispatch(new DungeonEditorIntent.SetTool(selection));
        }
    }

    private void handleOverlayInput(DungeonEditorControlsInput.OverlayInput overlay) {
        DungeonOverlaySettings currentOverlay =
                currentInteractionState().currentOverlayProjection();
        Optional<List<Integer>> parsedSelectedLevels = parseLevels(overlay.selectedLevelsText());
        if (parsedSelectedLevels.isEmpty()) {
            return;
        }
        if (overlay.mode() == null) {
            return;
        }
        List<Integer> selectedLevels = parsedSelectedLevels.orElseThrow();
        List<Integer> currentSelectedLevels = currentOverlay.selectedLevels();
        if (currentOverlay.modeKey().equals(overlay.mode().name())
                && currentOverlay.levelRange() == overlay.levelRange()
                && Double.compare(currentOverlay.opacity(), overlay.opacity()) == 0
                && currentSelectedLevels.equals(selectedLevels)) {
            return;
        }
        editorApi.dispatch(new DungeonEditorIntent.SetOverlay(new DungeonOverlaySettings(
                overlay.mode().name(), overlay.levelRange(), overlay.opacity(), selectedLevels)));
    }

    private static boolean hasMapEditorInput(DungeonEditorControlsInput.MapInput map) {
        return map.editorInputObserved()
                || map.createControlActivated()
                || map.renameControlActivated()
                || map.deleteControlActivated()
                || map.dismissControlActivated()
                || map.submitControlActivated()
                || map.confirmDeleteControlActivated();
    }

    private static boolean hasToolInput(DungeonEditorControlsInput.ToolInput tool) {
        return tool.selection() != null || tool.dismissControlActivated();
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

    private void submitCorridorPointMove(DungeonEditorStateInput.CorridorPointInput input) {
        Optional<Integer> q = parseInteger(input.q());
        Optional<Integer> r = parseInteger(input.r());
        if (q.isEmpty() || r.isEmpty()) {
            return;
        }
        editorApi.dispatch(new DungeonEditorIntent.CommitCorridorPoint(
                q.orElseThrow(), r.orElseThrow()));
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
        return currentInteractionState().currentSelectedTransitionId();
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

    private DungeonEditorIntent.@Nullable RoomNarrationInput toRoomNarrationInput(
            DungeonEditorStateInput.NarrationInput input
    ) {
        DungeonEditorStatePanelModel.RoomNarrationCardProjection card =
                statePanelModel.currentNarrationCard(input.roomId());
        if (card == null) {
            return null;
        }
        return new DungeonEditorIntent.RoomNarrationInput(
                card.roomId(),
                input.visualDescription(),
                narrationExits(card, input.exitDescriptions()).stream()
                        .map(DungeonEditorViewModel::toExitNarrationInput)
                        .toList());
    }

    private static List<DungeonEditorStatePanelModel.RoomExitNarrationProjection> narrationExits(
            DungeonEditorStatePanelModel.RoomNarrationCardProjection card,
            List<String> exitDescriptions
    ) {
        List<String> safeDescriptions = exitDescriptions == null ? List.of() : exitDescriptions;
        List<DungeonEditorStatePanelModel.RoomExitNarrationProjection> exits = card.exits();
        return java.util.stream.IntStream.range(0, exits.size())
                .mapToObj(index -> {
                    DungeonEditorStatePanelModel.RoomExitNarrationProjection exit = exits.get(index);
                    String description = index < safeDescriptions.size()
                            ? safeDescriptions.get(index)
                            : exit.description();
                    return exit.withDescription(description);
                })
                .toList();
    }

    private static DungeonEditorIntent.ExitNarrationInput toExitNarrationInput(
            DungeonEditorStatePanelModel.RoomExitNarrationProjection exit
    ) {
        return new DungeonEditorIntent.ExitNarrationInput(
                exit.label(),
                exit.q(),
                exit.r(),
                exit.level(),
                exit.direction(),
                exit.description());
    }


    record ControlsProjection(
            List<MapListEntry> mapEntries,
            String selectedMapKey,
            List<Integer> reachableLevels,
            boolean busy,
            String statusText,
            String viewModeLabel,
            DungeonOverlaySettings overlaySettings,
            int projectionLevel,
            DungeonEditorToolSelection toolSelection
    ) {
        ControlsProjection {
            mapEntries = mapEntries == null ? List.of() : List.copyOf(mapEntries);
            selectedMapKey = selectedMapKey == null ? "" : selectedMapKey;
            reachableLevels = reachableLevels == null ? List.of(0) : List.copyOf(reachableLevels);
            statusText = statusText == null ? "" : statusText;
            viewModeLabel = DungeonEditorControlsPanelModel.normalizeViewModeKey(viewModeLabel);
            overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
            toolSelection = toolSelection == null ? DungeonEditorToolSelection.select() : toolSelection;
        }

        static ControlsProjection initial() {
            return new ControlsProjection(
                    List.of(),
                    "",
                    List.of(0),
                    false,
                    "",
                    DungeonEditorControlsPanelModel.gridViewLabel(),
                    DungeonOverlaySettings.defaults(),
                    0,
                    DungeonEditorToolSelection.select());
        }

        static ControlsProjection from(DungeonEditorState state) {
            DungeonEditorState safeState = state == null ? DungeonEditorState.empty() : state;
            return new ControlsProjection(
                    safeState.catalog().stream()
                            .map(entry -> new MapListEntry(
                                    Long.toString(entry.mapId().value()),
                                    entry.mapId().value(),
                                    entry.mapName(),
                                    entry.revision()))
                            .toList(),
                    safeState.selectedMapId() == null
                            ? ""
                            : Long.toString(safeState.selectedMapId().value()),
                    safeState.reachableLevels(),
                    safeState.commandStatus().busy(),
                    safeState.commandStatus().message(),
                    safeState.viewMode() == features.dungeon.api.DungeonEditorViewMode.GRAPH
                            ? DungeonEditorControlsPanelModel.graphViewLabel()
                            : DungeonEditorControlsPanelModel.gridViewLabel(),
                    safeState.overlaySettings(),
                    safeState.projectionLevel(),
                    safeState.toolSelection());
        }
    }

    record InteractionState(
            long currentSelectedMapIdValue,
            String currentViewModeKey,
            DungeonEditorToolSelection currentToolSelection,
            int currentProjectionLevel,
            DungeonOverlaySettings currentOverlayProjection,
            long currentSelectedTransitionId,
            DungeonEditorIntent.TransitionDestinationInput currentTransitionDestination
    ) {
        InteractionState {
            currentSelectedMapIdValue = Math.max(0L, currentSelectedMapIdValue);
            currentViewModeKey = DungeonEditorControlsPanelModel.normalizeViewModeKey(currentViewModeKey);
            currentToolSelection = currentToolSelection == null
                    ? DungeonEditorToolSelection.select()
                    : currentToolSelection;
            currentOverlayProjection = currentOverlayProjection == null
                    ? DungeonOverlaySettings.defaults()
                    : currentOverlayProjection;
            currentSelectedTransitionId = Math.max(0L, currentSelectedTransitionId);
            currentTransitionDestination = currentTransitionDestination == null
                    ? DungeonEditorIntent.TransitionDestinationInput.empty()
                    : currentTransitionDestination;
        }

        static InteractionState empty() {
            return new InteractionState(
                    0L,
                    DungeonEditorControlsPanelModel.gridViewLabel(),
                    DungeonEditorToolSelection.select(),
                    0,
                    DungeonOverlaySettings.defaults(),
                    0L,
                    DungeonEditorIntent.TransitionDestinationInput.empty());
        }

        static InteractionState from(DungeonEditorState state) {
            DungeonEditorState safeState = state == null ? DungeonEditorState.empty() : state;
            var selectionRef = safeState.selection().topologyRef();
            long transitionId = selectionRef.kind()
                    == features.dungeon.api.DungeonTopologyElementKind.TRANSITION
                    ? selectionRef.id()
                    : 0L;
            var destination = safeState.draft().transitionDestination();
            return new InteractionState(
                    safeState.selectedMapId() == null ? 0L : safeState.selectedMapId().value(),
                    safeState.viewMode() == features.dungeon.api.DungeonEditorViewMode.GRAPH
                            ? DungeonEditorControlsPanelModel.graphViewLabel()
                            : DungeonEditorControlsPanelModel.gridViewLabel(),
                    safeState.toolSelection(),
                    safeState.projectionLevel(),
                    safeState.overlaySettings(),
                    transitionId,
                    new DungeonEditorIntent.TransitionDestinationInput(
                            destination.destinationType(),
                            destination.mapId(),
                            destination.tileId(),
                            destination.transitionId(),
                            destination.bidirectional()));
        }
    }

    record MapListEntry(
            String key,
            long mapIdValue,
            String mapName,
            long revision
    ) {
        MapListEntry {
            key = key == null ? "" : key;
            mapIdValue = Math.max(0L, mapIdValue);
            mapName = mapName == null || mapName.isBlank() ? defaultMapName() : mapName;
            revision = Math.max(0L, revision);
        }

        private static String defaultMapName() {
            return "Dungeon Map";
        }
    }

}
