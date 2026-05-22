package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonEditorApplicationService;
import src.domain.dungeon.published.CreateDungeonEditorCorridorCommand;
import src.domain.dungeon.published.CreateDungeonEditorDoorCommand;
import src.domain.dungeon.published.CreateDungeonEditorWallCommand;
import src.domain.dungeon.published.DeleteDungeonEditorCorridorCommand;
import src.domain.dungeon.published.DeleteDungeonEditorDoorCommand;
import src.domain.dungeon.published.DeleteDungeonEditorRoomCommand;
import src.domain.dungeon.published.DeleteDungeonEditorWallCommand;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorBoundaryTargetRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorPointerSample;
import src.domain.dungeon.published.DungeonEditorPointerTarget;
import src.domain.dungeon.published.DungeonEditorSelectionCommand;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.PaintDungeonEditorRoomCommand;
import src.domain.dungeon.published.SaveDungeonEditorRoomNarrationCommand;
import src.domain.dungeon.published.SelectDungeonEditorMapCommand;
import src.domain.dungeon.published.SetDungeonEditorOverlayCommand;
import src.domain.dungeon.published.SetDungeonEditorToolCommand;
import src.domain.dungeon.published.SetDungeonEditorViewModeCommand;
import src.domain.dungeon.published.ShiftDungeonEditorProjectionLevelCommand;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapViewInputEvent;

final class DungeonEditorIntentHandler {

    private final DungeonEditorContributionModel presentationModel;
    private final DungeonEditorControlsContentModel controlsContentModel;
    private final DungeonEditorStateContentModel stateContentModel;
    private final DungeonMapContentModel mapContentModel;
    private final DungeonEditorApplicationService editor;
    private final DungeonEditorToolWorkflowDispatch toolWorkflowDispatch;
    private Optional<HoverSample> lastHoverSample = Optional.empty();
    private double lastCameraDragCanvasX;
    private double lastCameraDragCanvasY;
    private boolean cameraDragActive;

    DungeonEditorIntentHandler(
            DungeonEditorContributionModel presentationModel,
            DungeonEditorControlsContentModel controlsContentModel,
            DungeonEditorStateContentModel stateContentModel,
            DungeonMapContentModel mapContentModel,
            DungeonEditorApplicationService editor
    ) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.controlsContentModel = Objects.requireNonNull(controlsContentModel, "controlsContentModel");
        this.stateContentModel = Objects.requireNonNull(stateContentModel, "stateContentModel");
        this.mapContentModel = Objects.requireNonNull(mapContentModel, "mapContentModel");
        this.editor = Objects.requireNonNull(editor, "editor");
        this.toolWorkflowDispatch = new DungeonEditorToolWorkflowDispatch(editor);
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
            editor.shiftProjectionLevel(new ShiftDungeonEditorProjectionLevelCommand(levelShift));
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
        stateContentModel.updateNarrationDraft(event.roomId(), event.visualDescription(), event.exitDescriptions());
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
            lastHoverSample = Optional.empty();
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
                && !event.buttons().middleButtonDown();
    }

    private void applyToolWorkflow(
            DungeonMapViewInputEvent event,
            DungeonEditorPointerSample pointerSample,
            DungeonEditorTool tool
    ) {
        toolWorkflowDispatch.apply(event, pointerSample, tool);
    }

    private void handleScroll(DungeonMapViewInputEvent event) {
        if (!event.modifiers().controlDown()) {
            return;
        }
        int levelDelta = normalizeLevelDelta(event.scrollDeltaY());
        if (levelDelta != 0) {
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
                DungeonEditorPointerTargetTranslator.toPublishedPointerTarget(target));
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
            editor.selectMap(new SelectDungeonEditorMapCommand(new DungeonMapId(selectedMapIdValue)));
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
            editor.createMap(new DungeonMapCatalogCommand.CreateMapCommand(draftName));
            return;
        }
        if (mapEditorUiState.isRenameMode()) {
            submitRename(mapEditorUiState, draftName);
        }
    }

    private void submitRename(DungeonEditorControlsContentModel.MapEditorUiState mapEditorUiState, String draftName) {
        long mapIdValue = mapEditorUiState.mapIdValue();
        long noSelectedMapId = 0L;
        if (mapIdValue > noSelectedMapId) {
            controlsContentModel.closeMapEditor();
            editor.renameMap(new DungeonMapCatalogCommand.RenameMapCommand(new DungeonMapId(mapIdValue), draftName));
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
            editor.deleteMap(new DeleteDungeonMapCommand(new DungeonMapId(mapIdValue)));
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
                editor.setViewMode(new SetDungeonEditorViewModeCommand(
                        DungeonEditorControlsContentModel.toPublishedViewMode(normalizedViewModeKey)));
            }
            return;
        }
        if (!DungeonEditorControlsContentModel.gridViewLabel().equals(selectedViewMode)) {
            editor.setViewMode(new SetDungeonEditorViewModeCommand(
                    DungeonEditorControlsContentModel.toPublishedViewMode(
                            DungeonEditorControlsContentModel.gridViewLabel())));
        }
    }

    private void handleToolInput(DungeonEditorControlsViewInputEvent.ToolSnapshot tool) {
        if (tool.dismissControlActivated()) {
            return;
        }
        DungeonEditorContributionModel.InteractionState interactionState = presentationModel.currentInteractionState();
        DungeonEditorTool selectedTool = DungeonEditorControlsContentModel.toPublishedToolKey(
                tool.selectedToolKey());
        if (!tool.selectedToolKey().isBlank() && selectedTool != interactionState.currentSelectedTool()) {
            editor.setTool(new SetDungeonEditorToolCommand(selectedTool));
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
        private final int cellQ;
        private final int cellR;
        private final boolean vertexPresent;
        private final int vertexQ;
        private final int vertexR;
        private final DungeonMapContentModel.PointerTarget target;

        private HoverSample(
                DungeonEditorTool tool,
                int cellQ,
                int cellR,
                boolean vertexPresent,
                int vertexQ,
                int vertexR,
                DungeonMapContentModel.PointerTarget target
        ) {
            this.tool = tool;
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
                double vertexSnapDistance
        ) {
            int vertexQ = (int) Math.round(sceneX);
            int vertexR = (int) Math.round(sceneY);
            boolean vertexPresent = Math.hypot(sceneX - vertexQ, sceneY - vertexR) <= vertexSnapDistance;
            return new HoverSample(
                    tool == null ? DungeonEditorTool.SELECT : tool,
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
                    && cellQ == other.cellQ
                    && cellR == other.cellR
                    && vertexPresent == other.vertexPresent
                    && vertexQ == other.vertexQ
                    && vertexR == other.vertexR
                    && Objects.equals(target, other.target);
        }
    }

    private interface DungeonEditorPointerTargetTranslator {

        static DungeonEditorPointerTarget toPublishedPointerTarget(DungeonMapContentModel.PointerTarget target) {
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
            return value == null ? "" : value.trim().toUpperCase(Locale.ROOT).replace('-', '_');
        }
    }

    private static final class DungeonEditorToolWorkflowDispatch {
        private final DungeonEditorApplicationService editor;
        private final Map<DungeonEditorTool, ToolWorkflow> workflows;

        DungeonEditorToolWorkflowDispatch(DungeonEditorApplicationService editor) {
            this.editor = Objects.requireNonNull(editor, "editor");
            Map<DungeonEditorTool, ToolWorkflow> registeredWorkflows =
                    new java.util.EnumMap<>(DungeonEditorTool.class);
            registerSelectionWorkflow(registeredWorkflows);
            registerRoomWorkflows(registeredWorkflows);
            registerWallWorkflows(registeredWorkflows);
            registerDoorWorkflows(registeredWorkflows);
            registerCorridorWorkflows(registeredWorkflows);
            workflows = Map.copyOf(registeredWorkflows);
        }

        void apply(
                DungeonMapViewInputEvent event,
                DungeonEditorPointerSample pointerSample,
                DungeonEditorTool tool
        ) {
            ToolWorkflow workflow = workflows.get(Objects.requireNonNull(tool, "tool"));
            if (workflow != null) {
                workflow.apply(event.input(), pointerSample);
            }
        }

        private void registerSelectionWorkflow(Map<DungeonEditorTool, ToolWorkflow> registeredWorkflows) {
            registeredWorkflows.put(
                    DungeonEditorTool.SELECT,
                    new ToolWorkflow(
                            pointerSample -> editor.pressSelection(
                                    new DungeonEditorSelectionCommand(pointerSample)),
                            pointerSample -> editor.dragSelection(
                                    new DungeonEditorSelectionCommand(pointerSample)),
                            pointerSample -> editor.releaseSelection(
                                    new DungeonEditorSelectionCommand(pointerSample)),
                            pointerSample -> editor.hoverSelection(
                                    new DungeonEditorSelectionCommand(pointerSample))));
        }

        private void registerRoomWorkflows(Map<DungeonEditorTool, ToolWorkflow> registeredWorkflows) {
            registeredWorkflows.put(
                    DungeonEditorTool.ROOM_PAINT,
                    new ToolWorkflow(
                            pointerSample -> editor.pressPaintRoom(
                                    new PaintDungeonEditorRoomCommand(pointerSample)),
                            pointerSample -> editor.dragPaintRoom(
                                    new PaintDungeonEditorRoomCommand(pointerSample)),
                            pointerSample -> editor.releasePaintRoom(
                                    new PaintDungeonEditorRoomCommand(pointerSample)),
                            null));
            registeredWorkflows.put(
                    DungeonEditorTool.ROOM_DELETE,
                    new ToolWorkflow(
                            pointerSample -> editor.pressDeleteRoom(
                                    new DeleteDungeonEditorRoomCommand(pointerSample)),
                            pointerSample -> editor.dragDeleteRoom(
                                    new DeleteDungeonEditorRoomCommand(pointerSample)),
                            pointerSample -> editor.releaseDeleteRoom(
                                    new DeleteDungeonEditorRoomCommand(pointerSample)),
                            null));
        }

        private void registerWallWorkflows(Map<DungeonEditorTool, ToolWorkflow> registeredWorkflows) {
            registeredWorkflows.put(
                    DungeonEditorTool.WALL_CREATE,
                    new ToolWorkflow(
                            pointerSample -> editor.pressCreateWall(
                                    new CreateDungeonEditorWallCommand(pointerSample)),
                            pointerSample -> editor.dragCreateWall(
                                    new CreateDungeonEditorWallCommand(pointerSample)),
                            null,
                            pointerSample -> editor.hoverCreateWall(
                                    new CreateDungeonEditorWallCommand(pointerSample))));
            registeredWorkflows.put(
                    DungeonEditorTool.WALL_DELETE,
                    new ToolWorkflow(
                            pointerSample -> editor.pressDeleteWall(
                                    new DeleteDungeonEditorWallCommand(pointerSample)),
                            pointerSample -> editor.dragDeleteWall(
                                    new DeleteDungeonEditorWallCommand(pointerSample)),
                            null,
                            pointerSample -> editor.hoverDeleteWall(
                                    new DeleteDungeonEditorWallCommand(pointerSample))));
        }

        private void registerDoorWorkflows(Map<DungeonEditorTool, ToolWorkflow> registeredWorkflows) {
            registeredWorkflows.put(
                    DungeonEditorTool.DOOR_CREATE,
                    new ToolWorkflow(
                            pointerSample -> editor.pressCreateDoor(
                                    new CreateDungeonEditorDoorCommand(pointerSample)),
                            pointerSample -> editor.dragCreateDoor(
                                    new CreateDungeonEditorDoorCommand(pointerSample)),
                            pointerSample -> editor.releaseCreateDoor(
                                    new CreateDungeonEditorDoorCommand(pointerSample)),
                            pointerSample -> editor.hoverCreateDoor(
                                    new CreateDungeonEditorDoorCommand(pointerSample))));
            registeredWorkflows.put(
                    DungeonEditorTool.DOOR_DELETE,
                    new ToolWorkflow(
                            pointerSample -> editor.pressDeleteDoor(
                                    new DeleteDungeonEditorDoorCommand(pointerSample)),
                            pointerSample -> editor.dragDeleteDoor(
                                    new DeleteDungeonEditorDoorCommand(pointerSample)),
                            pointerSample -> editor.releaseDeleteDoor(
                                    new DeleteDungeonEditorDoorCommand(pointerSample)),
                            pointerSample -> editor.hoverDeleteDoor(
                                    new DeleteDungeonEditorDoorCommand(pointerSample))));
        }

        private void registerCorridorWorkflows(Map<DungeonEditorTool, ToolWorkflow> registeredWorkflows) {
            registeredWorkflows.put(
                    DungeonEditorTool.CORRIDOR_CREATE,
                    new ToolWorkflow(
                            pointerSample -> editor.pressCreateCorridor(
                                    new CreateDungeonEditorCorridorCommand(pointerSample)),
                            null,
                            null,
                            pointerSample -> editor.hoverCreateCorridor(
                                    new CreateDungeonEditorCorridorCommand(pointerSample))));
            registeredWorkflows.put(
                    DungeonEditorTool.CORRIDOR_DELETE,
                    new ToolWorkflow(
                            pointerSample -> editor.pressDeleteCorridor(
                                    new DeleteDungeonEditorCorridorCommand(pointerSample)),
                            null,
                            null,
                            pointerSample -> editor.hoverDeleteCorridor(
                                    new DeleteDungeonEditorCorridorCommand(pointerSample))));
        }

        @FunctionalInterface
        private interface PointerAction {
            void apply(DungeonEditorPointerSample pointerSample);
        }

        private static final class ToolWorkflow {
            private final @Nullable PointerAction pressed;
            private final @Nullable PointerAction dragged;
            private final @Nullable PointerAction released;
            private final @Nullable PointerAction moved;

            private ToolWorkflow(
                    @Nullable PointerAction pressed,
                    @Nullable PointerAction dragged,
                    @Nullable PointerAction released,
                    @Nullable PointerAction moved
            ) {
                this.pressed = pressed;
                this.dragged = dragged;
                this.released = released;
                this.moved = moved;
            }

            private void apply(
                    DungeonMapViewInputEvent.CanvasInput input,
                    DungeonEditorPointerSample pointerSample
            ) {
                if (input.mousePressed()) {
                    applyAction(pressed, pointerSample);
                } else if (input.mouseDragged()) {
                    applyAction(dragged, pointerSample);
                } else if (input.mouseReleased()) {
                    applyAction(released, pointerSample);
                } else if (input.mouseMoved()) {
                    applyAction(moved, pointerSample);
                }
            }

            private static void applyAction(
                    @Nullable PointerAction action,
                    DungeonEditorPointerSample pointerSample
            ) {
                if (action != null) {
                    action.apply(pointerSample);
                }
            }
        }
    }
}
