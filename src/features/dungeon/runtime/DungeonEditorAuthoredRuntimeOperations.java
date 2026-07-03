package src.features.dungeon.runtime;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.SortedSet;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.RenameDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorLabelNameUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorRoomNarrationUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorStairGeometryUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorTransitionDescriptionUseCase;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorTransitionLinkUseCase;
import src.domain.dungeon.model.runtime.usecase.SelectDungeonEditorMapUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorOverlayUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorToolUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorViewModeUseCase;
import src.domain.dungeon.model.runtime.usecase.ShiftDungeonEditorProjectionLevelUseCase;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOverlaySettings;

final class DungeonEditorAuthoredRuntimeOperations {
    private static final String SELECTION_TOOL = "SELECT";

    private final SelectDungeonEditorMapUseCase selectMapUseCase;
    private final CreateDungeonEditorMapUseCase createMapUseCase;
    private final RenameDungeonEditorMapUseCase renameMapUseCase;
    private final DeleteDungeonEditorMapUseCase deleteMapUseCase;
    private final SetDungeonEditorViewModeUseCase setViewModeUseCase;
    private final SetDungeonEditorToolUseCase setToolUseCase;
    private final ShiftDungeonEditorProjectionLevelUseCase shiftProjectionLevelUseCase;
    private final SetDungeonEditorOverlayUseCase setOverlayUseCase;
    private final DungeonEditorRoomPaintRuntimeOperation roomPaintOperation;
    private final DungeonEditorWallBoundaryDraftRuntimeOperation wallBoundaryDraftOperation;
    private final DungeonEditorDoorBoundaryDraftRuntimeOperation doorBoundaryDraftOperation;
    private final DungeonEditorCorridorDraftRuntimeOperation corridorDraftOperation;
    private final DungeonEditorStairDraftRuntimeOperation stairDraftOperation;
    private final DungeonEditorStairDeleteRuntimeOperation stairDeleteOperation;
    private final DungeonEditorTransitionRuntimeOperation transitionOperation;
    private final DungeonEditorFeatureMarkerRuntimeOperation featureMarkerOperation;
    private final DungeonEditorSelectedHandleRuntimeOperation selectedHandleOperation;
    private final SaveDungeonEditorRoomNarrationUseCase saveRoomNarrationUseCase;
    private final SaveDungeonEditorLabelNameUseCase saveLabelNameUseCase;
    private final SaveDungeonEditorTransitionDescriptionUseCase saveTransitionDescriptionUseCase;
    private final SaveDungeonEditorTransitionLinkUseCase saveTransitionLinkUseCase;
    private final SaveDungeonEditorStairGeometryUseCase saveStairGeometryUseCase;

    DungeonEditorAuthoredRuntimeOperations(DungeonEditorAuthoredRuntimeOperationUseCases useCases) {
        DungeonEditorAuthoredRuntimeOperationUseCases safeUseCases =
                Objects.requireNonNull(useCases, "useCases");
        selectMapUseCase = Objects.requireNonNull(safeUseCases.map().select(), "selectMapUseCase");
        createMapUseCase = Objects.requireNonNull(safeUseCases.map().create(), "createMapUseCase");
        renameMapUseCase = Objects.requireNonNull(safeUseCases.map().rename(), "renameMapUseCase");
        deleteMapUseCase = Objects.requireNonNull(safeUseCases.map().delete(), "deleteMapUseCase");
        setViewModeUseCase = Objects.requireNonNull(safeUseCases.projection().setViewMode(), "setViewModeUseCase");
        setToolUseCase = Objects.requireNonNull(safeUseCases.projection().setTool(), "setToolUseCase");
        shiftProjectionLevelUseCase = Objects.requireNonNull(
                safeUseCases.projection().shiftLevel(),
                "shiftProjectionLevelUseCase");
        setOverlayUseCase = Objects.requireNonNull(safeUseCases.projection().setOverlay(), "setOverlayUseCase");
        roomPaintOperation = Objects.requireNonNull(safeUseCases.roomPaint(), "roomPaintOperation");
        wallBoundaryDraftOperation = Objects.requireNonNull(
                safeUseCases.wallBoundaryDraft(),
                "wallBoundaryDraftOperation");
        doorBoundaryDraftOperation = Objects.requireNonNull(
                safeUseCases.doorBoundaryDraft(),
                "doorBoundaryDraftOperation");
        corridorDraftOperation = Objects.requireNonNull(
                safeUseCases.corridorDraft(),
                "corridorDraftOperation");
        stairDraftOperation = Objects.requireNonNull(
                safeUseCases.stairDraft(),
                "stairDraftOperation");
        stairDeleteOperation = Objects.requireNonNull(
                safeUseCases.stairDelete(),
                "stairDeleteOperation");
        transitionOperation = Objects.requireNonNull(
                safeUseCases.transition(),
                "transitionOperation");
        featureMarkerOperation = Objects.requireNonNull(
                safeUseCases.featureMarker(),
                "featureMarkerOperation");
        selectedHandleOperation = Objects.requireNonNull(
                safeUseCases.selectedHandle(),
                "selectedHandleOperation");
        saveRoomNarrationUseCase = Objects.requireNonNull(
                safeUseCases.detail().saveRoomNarration(),
                "saveRoomNarrationUseCase");
        saveLabelNameUseCase = Objects.requireNonNull(
                safeUseCases.detail().saveLabelName(),
                "saveLabelNameUseCase");
        saveTransitionDescriptionUseCase = Objects.requireNonNull(
                safeUseCases.detail().saveTransitionDescription(),
                "saveTransitionDescriptionUseCase");
        saveTransitionLinkUseCase = Objects.requireNonNull(
                safeUseCases.detail().saveTransitionLink(),
                "saveTransitionLinkUseCase");
        saveStairGeometryUseCase = Objects.requireNonNull(
                safeUseCases.detail().saveStairGeometry(),
                "saveStairGeometryUseCase");
    }

    DungeonEditorRuntimeOperationResult selectMap(long mapIdValue) {
        stairDraftOperation.clear();
        return resultFromSnapshot(selectMapUseCase.execute(mapIdValue));
    }

    DungeonEditorRuntimeOperationResult createMap(String mapName) {
        stairDraftOperation.clear();
        return resultFromSnapshot(createMapUseCase.execute(mapName));
    }

    DungeonEditorRuntimeOperationResult renameMap(long mapIdValue, String mapName) {
        return resultFromSnapshot(renameMapUseCase.execute(mapIdValue, mapName));
    }

    DungeonEditorRuntimeOperationResult deleteMap(long mapIdValue) {
        stairDraftOperation.clear();
        return resultFromSnapshot(deleteMapUseCase.execute(mapIdValue));
    }

    DungeonEditorRuntimeOperationResult setViewMode(String viewModeKey) {
        stairDraftOperation.clear();
        return resultFromSessionFrame(
                setViewModeUseCase.execute(DungeonEditorRuntimeInputTranslator.viewModeName(viewModeKey)));
    }

    DungeonEditorRuntimeOperationResult setTool(String toolKey) {
        stairDraftOperation.clear();
        return resultFromControls(
                setToolUseCase.executeControlsOnly(DungeonEditorRuntimeInputTranslator.toolName(toolKey)));
    }

    DungeonEditorRuntimeOperationResult setToolAndPublishSnapshot(String toolKey) {
        stairDraftOperation.clear();
        return resultFromSnapshot(setToolUseCase.execute(DungeonEditorRuntimeInputTranslator.toolName(toolKey)));
    }

    DungeonEditorRuntimeOperationResult cancelActivePreviewSession() {
        stairDraftOperation.clear();
        return resultFromSnapshot(setToolUseCase.execute(SELECTION_TOOL));
    }

    DungeonEditorRuntimeOperationResult shiftProjectionLevel(int levelShift) {
        DungeonEditorSessionSnapshot.SessionFrameData frameData = shiftProjectionLevelUseCase.execute(levelShift);
        return resultFromSessionFrame(frameData)
                .merge(stairDraftOperation.refreshAfterProjectionLevelChanged());
    }

    DungeonEditorRuntimeOperationResult setOverlay(
            String modeKey,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels
    ) {
        return resultFromSessionFrame(setOverlayUseCase.execute(modeKey, levelRange, opacity, selectedLevels));
    }

    DungeonEditorRuntimeOperationResult applyRoomPaint(
            PointerAction action,
            DungeonEditorSessionValues.Tool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return roomPaintOperation.apply(action, tool, sample, wallSingleClickMode, transitionDestination);
    }

    DungeonEditorRuntimeOperationResult applyStairDelete(
            PointerAction action,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return stairDeleteOperation.apply(action, sample, wallSingleClickMode, transitionDestination);
    }

    DungeonEditorRuntimeOperationResult applyTransition(
            PointerAction action,
            DungeonEditorTool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return transitionOperation.apply(
                action,
                tool,
                sample,
                wallSingleClickMode,
                transitionDestination);
    }

    DungeonEditorRuntimeOperationResult applyFeatureMarker(
            PointerAction action,
            DungeonEditorTool tool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return featureMarkerOperation.apply(
                action,
                tool,
                sample,
                wallSingleClickMode,
                transitionDestination);
    }

    DungeonEditorRuntimeOperationResult applyWallBoundaryDraft(
            PointerAction action,
            DungeonEditorTool wallTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return wallBoundaryDraftOperation.apply(
                action,
                wallTool,
                sample,
                wallSingleClickMode,
                transitionDestination);
    }

    DungeonEditorRuntimeOperationResult applyDoorBoundaryDraft(
            PointerAction action,
            DungeonEditorTool doorTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return doorBoundaryDraftOperation.apply(
                action,
                doorTool,
                sample,
                wallSingleClickMode,
                transitionDestination);
    }

    DungeonEditorRuntimeOperationResult applyCorridorDraft(
            PointerAction action,
            DungeonEditorTool corridorTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return corridorDraftOperation.apply(
                action,
                corridorTool,
                sample,
                wallSingleClickMode,
                transitionDestination);
    }

    DungeonEditorRuntimeOperationResult applyStairDraft(
            PointerAction action,
            DungeonEditorTool stairTool,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return stairDraftOperation.apply(
                action,
                stairTool,
                sample,
                wallSingleClickMode,
                transitionDestination);
    }

    DungeonEditorRuntimeOperationResult applySelectionHandlePreview(
            PointerAction action,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        return selectedHandleOperation.apply(action, sample, wallSingleClickMode, transitionDestination);
    }

    DungeonEditorRuntimeOperationResult scrollSelection(int levelDelta) {
        return selectedHandleOperation.scroll(levelDelta);
    }

    DungeonEditorRuntimeOperationResult moveCorridorPoint(
            DungeonEditorWorkspaceValues.HandleRef handle,
            int q,
            int r
    ) {
        return selectedHandleOperation.moveCorridorPoint(handle, q, r);
    }

    DungeonEditorRuntimeOperationResult saveRoomNarration(RoomNarration narration) {
        RoomNarration safeNarration = narration == null ? new RoomNarration(0L, "", List.of()) : narration;
        return resultFromSnapshot(saveRoomNarrationUseCase.execute(new SaveDungeonEditorRoomNarrationUseCase.RoomNarrationInput(
                safeNarration.roomId(),
                safeNarration.visualDescription(),
                DungeonEditorRuntimeInputTranslator.exitInputs(safeNarration))));
    }

    DungeonEditorRuntimeOperationResult saveLabelName(
            DungeonEditorRuntimeLabelTarget target,
            String name
    ) {
        DungeonEditorRuntimeLabelTarget safeTarget = DungeonEditorRuntimeLabelTarget.orEmpty(target);
        return resultFromSnapshot(saveLabelNameUseCase.execute(new SaveDungeonEditorLabelNameUseCase.LabelNameInput(
                safeTarget.targetKind(),
                safeTarget.targetId(),
                name)));
    }

    DungeonEditorRuntimeOperationResult saveTransitionLink(
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        return resultFromSnapshot(saveTransitionLinkUseCase.execute(new SaveDungeonEditorTransitionLinkUseCase.TransitionLinkInput(
                sourceTransitionId,
                targetMapId,
                targetTransitionId,
                bidirectional)));
    }

    DungeonEditorRuntimeOperationResult saveTransitionDescription(
            long transitionId,
            String description
    ) {
        return resultFromSnapshot(saveTransitionDescriptionUseCase.execute(
                new SaveDungeonEditorTransitionDescriptionUseCase.TransitionDescriptionInput(transitionId, description)));
    }

    DungeonEditorRuntimeOperationResult saveStairGeometry(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        return resultFromSnapshot(saveStairGeometryUseCase.execute(new SaveDungeonEditorStairGeometryUseCase.StairGeometryInput(
                stairId,
                shapeName,
                directionName,
                dimension1,
                dimension2)));
    }

    static DungeonEditorRuntimeOperationResult resultFromSnapshot(
            DungeonEditorSessionSnapshot.@Nullable SnapshotData snapshot
    ) {
        if (snapshot == null) {
            return DungeonEditorRuntimeOperationResult.publishAfterStateModelSideEffect();
        }
        List<DungeonEditorAction> actions = new ArrayList<>();
        actions.add(new DungeonEditorAction.SelectViewMode(viewMode(snapshot.viewMode())));
        actions.add(new DungeonEditorAction.SelectTool(tool(snapshot.selectedTool())));
        actions.add(new DungeonEditorAction.SetProjectionLevel(snapshot.projectionLevel()));
        actions.add(new DungeonEditorAction.SetOverlay(overlay(snapshot.overlaySettings())));
        actions.add(new DungeonEditorAction.SelectMap(mapId(snapshot.selectedMapId())));
        actions.add(new DungeonEditorAction.SetMapSummaries(mapSummaries(snapshot.maps())));
        actions.add(new DungeonEditorAction.SetSurfaceLoaded(snapshot.surface() != null));
        actions.add(new DungeonEditorAction.SetReachableLevels(reachableLevels(snapshot)));
        actions.add(new DungeonEditorAction.SetStatusText(snapshot.statusText()));
        return DungeonEditorRuntimeOperationResult.publish(actions);
    }

    private static DungeonEditorRuntimeOperationResult resultFromSessionFrame(
            DungeonEditorSessionSnapshot.@Nullable SessionFrameData frameData
    ) {
        if (frameData == null) {
            return DungeonEditorRuntimeOperationResult.publishAfterStateModelSideEffect();
        }
        return resultFromControls(frameData.controlsData());
    }

    private static DungeonEditorRuntimeOperationResult resultFromControls(
            DungeonEditorSessionSnapshot.@Nullable ControlsData controls
    ) {
        if (controls == null) {
            return DungeonEditorRuntimeOperationResult.publishAfterStateModelSideEffect();
        }
        return DungeonEditorRuntimeOperationResult.publish(
                new DungeonEditorAction.SelectViewMode(viewMode(controls.viewMode())),
                new DungeonEditorAction.SelectTool(tool(controls.selectedTool())),
                new DungeonEditorAction.SetProjectionLevel(controls.projectionLevel()),
                new DungeonEditorAction.SetOverlay(overlay(controls.overlaySettings())),
                new DungeonEditorAction.SelectMap(mapId(controls.selectedMapId())),
                new DungeonEditorAction.SetStatusText(controls.statusText()));
    }

    private static List<Integer> reachableLevels(DungeonEditorSessionSnapshot.SnapshotData snapshot) {
        SortedSet<Integer> levels = new TreeSet<>();
        DungeonEditorSessionSnapshot.SurfaceData surface = snapshot.surface();
        if (surface != null && surface.map() != null) {
            addMapLevels(levels, surface.map());
            if (surface.previewMap() != null) {
                addMapLevels(levels, surface.previewMap());
            }
        }
        if (levels.isEmpty()) {
            levels.add(snapshot.projectionLevel());
        }
        return List.copyOf(levels);
    }

    private static void addMapLevels(
            SortedSet<Integer> levels,
            DungeonEditorWorkspaceValues.MapSnapshot map
    ) {
        for (DungeonEditorWorkspaceValues.Area area : map.areas()) {
            addCellLevels(levels, area.cells());
        }
        for (DungeonEditorWorkspaceValues.Feature feature : map.features()) {
            addCellLevels(levels, feature.cells());
        }
        for (DungeonEditorWorkspaceValues.Handle handle : map.editorHandles()) {
            levels.add(handle.cell().level());
        }
    }

    private static void addCellLevels(
            SortedSet<Integer> levels,
            List<DungeonEditorWorkspaceValues.Cell> cells
    ) {
        for (DungeonEditorWorkspaceValues.Cell cell
                : cells == null ? List.<DungeonEditorWorkspaceValues.Cell>of() : cells) {
            levels.add(cell.level());
        }
    }

    private static List<DungeonMapSummary> mapSummaries(List<DungeonEditorWorkspaceValues.MapSummary> maps) {
        List<DungeonMapSummary> result = new ArrayList<>();
        for (DungeonEditorWorkspaceValues.MapSummary map
                : maps == null ? List.<DungeonEditorWorkspaceValues.MapSummary>of() : maps) {
            result.add(mapSummary(map));
        }
        return List.copyOf(result);
    }

    private static DungeonMapSummary mapSummary(DungeonEditorWorkspaceValues.MapSummary map) {
        DungeonEditorWorkspaceValues.MapSummary safeMap = map == null
                ? new DungeonEditorWorkspaceValues.MapSummary(
                        new DungeonEditorWorkspaceValues.MapId(1L),
                        "Dungeon Map",
                        0L)
                : map;
        return new DungeonMapSummary(
                mapId(safeMap.mapId()),
                safeMap.mapName(),
                safeMap.revision());
    }

    private static DungeonMapId mapId(DungeonEditorWorkspaceValues.MapId mapId) {
        return mapId == null ? null : new DungeonMapId(mapId.value());
    }

    private static DungeonEditorViewMode viewMode(DungeonEditorSessionValues.ViewMode viewMode) {
        return viewMode != null && "GRAPH".equals(viewMode.name())
                ? DungeonEditorViewMode.GRAPH
                : DungeonEditorViewMode.GRID;
    }

    private static DungeonEditorTool tool(DungeonEditorSessionValues.Tool tool) {
        return tool == null ? DungeonEditorTool.SELECT : DungeonEditorTool.valueOf(tool.name());
    }

    private static DungeonOverlaySettings overlay(DungeonEditorSessionValues.OverlaySettings overlay) {
        DungeonEditorSessionValues.OverlaySettings safeOverlay = overlay == null
                ? DungeonEditorSessionValues.OverlaySettings.defaults()
                : overlay;
        return new DungeonOverlaySettings(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }
}
