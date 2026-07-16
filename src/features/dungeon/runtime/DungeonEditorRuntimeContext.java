package src.features.dungeon.runtime;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonAuthoredApplicationService;
import src.domain.dungeon.DungeonEditorRuntimeApplicationService;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.feature.FeatureMarkerKind;
import src.domain.dungeon.model.core.structure.stair.StairGeometrySpec;
import src.domain.dungeon.model.core.structure.transition.TransitionAnchor;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonFacts;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;

final class DungeonEditorRuntimeContext {
    private final DungeonEditorRuntimeApplicationService.RuntimeSession session;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;

    private DungeonEditorRuntimeContext(
            DungeonEditorRuntimeApplicationService.RuntimeSession session,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter
    ) {
        this.session = Objects.requireNonNull(session, "session");
        this.mainViewInterpreter = Objects.requireNonNull(mainViewInterpreter, "mainViewInterpreter");
    }

    static Startup create(
            DungeonEditorRuntimeDependencies dependencies,
            DungeonEditorMainViewInteractionState interactionState
    ) {
        DungeonEditorRuntimeDependencies safeDependencies =
                Objects.requireNonNull(dependencies, "dependencies");
        DungeonEditorMainViewInteractionState safeInteractionState =
                Objects.requireNonNull(interactionState, "interactionState");
        DungeonEditorDungeonState dungeonState = new DungeonEditorDungeonState();
        InterpretDungeonEditorMainViewInputUseCase interpreter =
                new InterpretDungeonEditorMainViewInputUseCase(safeInteractionState);
        return safeDependencies.editorRuntimeApplicationService().openSession(
                dungeonState,
                runtimeSession -> {
                    DungeonEditorRuntimeContext context =
                            new DungeonEditorRuntimeContext(runtimeSession, interpreter);
                    return new Startup(context, context.fromSnapshot(runtimeSession.publishCurrent()));
                });
    }

    boolean hasSelectedMap() {
        return session.hasSelectedMap();
    }

    @Nullable MapId selectedMapId() {
        return session.selectedMapId();
    }

    int projectionLevel() {
        return session.projectionLevel();
    }

    DungeonEditorSessionValues.Selection selection() {
        return session.selection();
    }

    void applySessionEffect(DungeonEditorSessionEffect effect) {
        session.applySessionEffect(effect);
    }

    void clearPreviewWithStatus(String statusText) {
        session.clearPreviewWithStatus(statusText);
    }

    DungeonEditorDungeonFacts currentFacts() {
        return session.currentFacts();
    }

    DungeonEditorRuntimeApplicationService.CurrentGridPublication currentGridOrPublishCurrentResult() {
        return session.committedGridOrPublishCurrentResult();
    }

    MapSnapshot loadCommittedSnapshot() {
        return session.loadCommittedSnapshot();
    }

    Result applyEffect(
            DungeonEditorSessionEffect effect,
            DungeonEditorRuntimeApplicationService.@Nullable AuthoredCommit authoredCommit
    ) {
        return fromPublication(session.applyEffect(effect, authoredCommit));
    }

    DungeonEditorRuntimeApplicationService.PublicationResult applyEffectPublication(
            DungeonEditorSessionEffect effect,
            DungeonEditorRuntimeApplicationService.@Nullable AuthoredCommit authoredCommit
    ) {
        return session.applyEffect(effect, authoredCommit);
    }

    Result selectMap(long mapIdValue) {
        return fromSnapshot(session.selectMap(mapIdValue));
    }

    Result publishCurrent() {
        return fromSnapshot(session.publishCurrent());
    }

    Result createMap(String mapName) {
        return fromSnapshot(session.createMap(mapName));
    }

    Result renameMap(long mapIdValue, String mapName) {
        return fromSnapshot(session.renameMap(mapIdValue, mapName));
    }

    Result deleteMap(long mapIdValue) {
        return fromSnapshot(session.deleteMap(mapIdValue));
    }

    Result setViewMode(DungeonEditorViewMode viewMode) {
        return fromSessionFrame(session.setViewMode(DungeonEditorRuntimeInputTranslator.viewMode(viewMode)));
    }

    Result setTool(DungeonEditorTool tool) {
        return fromControls(session.setToolControlsOnly(DungeonEditorRuntimeInputTranslator.tool(tool)));
    }

    Result setToolAndPublishSnapshot(DungeonEditorTool tool) {
        return fromSnapshot(session.setTool(DungeonEditorRuntimeInputTranslator.tool(tool)));
    }

    Result cancelActivePreviewSession() {
        return fromSnapshot(session.setTool(DungeonEditorSessionValues.Tool.SELECT));
    }

    Result shiftProjectionLevel(int levelShift) {
        return fromSessionFrame(session.shiftProjectionLevel(levelShift));
    }

    Result setOverlay(DungeonEditorOverlaySettings overlaySettings) {
        return fromSessionFrame(session.setOverlay(DungeonEditorRuntimeInputTranslator.overlaySettings(overlaySettings)));
    }

    Result saveRoomNarration(RoomNarration narration) {
        RoomNarration safeNarration = narration == null ? new RoomNarration(0L, "", java.util.List.of()) : narration;
        return fromSnapshot(session.saveRoomNarration(new DungeonAuthoredApplicationService.RoomNarrationInput(
                safeNarration.roomId(),
                safeNarration.visualDescription(),
                DungeonEditorRuntimeInputTranslator.exitInputs(safeNarration))));
    }

    Result saveLabelName(DungeonEditorRuntimeLabelTarget target, String name) {
        DungeonEditorRuntimeLabelTarget safeTarget = DungeonEditorRuntimeLabelTarget.orEmpty(target);
        return fromSnapshot(session.saveLabelName(new DungeonAuthoredApplicationService.LabelNameInput(
                labelTargetKind(safeTarget),
                safeTarget.targetId(),
                name)));
    }

    Result saveTransitionLink(long sourceTransitionId, TransitionDestinationDraftInput input) {
        TransitionDestinationDraftInput safeInput = input == null
                ? TransitionDestinationDraftInput.unlinkedEntrance()
                : input;
        return fromOperationResult(session.saveTransitionLink(
                new DungeonAuthoredApplicationService.TransitionLinkInput(
                        sourceTransitionId,
                        safeInput.targetMapId(),
                        safeInput.targetTransitionId(),
                        safeInput.bidirectional())));
    }

    Result saveTransitionDescription(long transitionId, String description) {
        return fromSnapshot(session.saveTransitionDescription(
                new DungeonAuthoredApplicationService.TransitionDescriptionInput(
                        transitionId,
                        description)));
    }

    Result saveStairGeometry(StairGeometryDraftInput input) {
        StairGeometryDraftInput safeInput = input == null ? StairGeometryDraftInput.empty() : input;
        return fromSnapshot(session.saveStairGeometry(new DungeonAuthoredApplicationService.StairGeometryInput(
                safeInput.stairId(),
                safeInput.shapeName(),
                safeInput.directionName(),
                safeInput.dimension1Value().orElse(0),
                safeInput.dimension2Value().orElse(0))));
    }

    void applyRoomRectangle(
            MapId mapId,
            Cell start,
            Cell end,
            boolean deleteMode
    ) {
        session.applyRoomRectangle(mapId, start, end, deleteMode);
    }

    boolean canCreateStair(MapId mapId, StairGeometrySpec spec) {
        return session.canCreateStair(mapId, spec);
    }

    void createStair(MapId mapId, StairGeometrySpec spec) {
        session.createStair(mapId, spec);
    }

    boolean deleteStair(MapId mapId, long stairId) {
        return session.deleteStair(mapId, stairId);
    }

    boolean canCreateTransition(
            MapId mapId,
            TransitionAnchor anchor,
            src.domain.dungeon.model.core.structure.transition.TransitionDestination destination
    ) {
        return session.canCreateTransition(mapId, anchor, destination);
    }

    void createTransition(
            MapId mapId,
            TransitionAnchor anchor,
            src.domain.dungeon.model.core.structure.transition.TransitionDestination destination
    ) {
        session.createTransition(mapId, anchor, destination);
    }

    boolean deleteTransition(MapId mapId, long transitionId) {
        return session.deleteTransition(mapId, transitionId);
    }

    boolean canCreateFeatureMarker(MapId mapId, FeatureMarkerKind kind, Cell anchor) {
        return session.canCreateFeatureMarker(mapId, kind, anchor);
    }

    long createFeatureMarker(MapId mapId, FeatureMarkerKind kind, Cell anchor) {
        return session.createFeatureMarker(mapId, kind, anchor);
    }

    boolean deleteFeatureMarker(MapId mapId, long markerId) {
        return session.deleteFeatureMarker(mapId, markerId);
    }

    void createCorridor(MapId mapId, DungeonEditorSessionValues.CorridorCreatePreview preview) {
        session.createCorridor(mapId, preview);
    }

    void deleteCorridor(MapId mapId, DungeonEditorSessionValues.DeleteCorridorPreview preview) {
        session.deleteCorridor(mapId, preview);
    }

    void applyDoorBoundary(
            MapId mapId,
            long clusterId,
            DungeonEditorWorkspaceValues.Edge edge,
            boolean deleteMode
    ) {
        session.applyDoorBoundary(mapId, clusterId, edge, deleteMode);
    }

    void applyWallBoundary(
            MapId mapId,
            long clusterId,
            java.util.List<DungeonEditorWorkspaceValues.Edge> edges,
            boolean deleteMode
    ) {
        session.applyWallBoundary(mapId, clusterId, edges, deleteMode);
    }

    void moveClusterHandle(MapId mapId, DungeonEditorSessionValues.MoveHandlePreview preview) {
        session.moveClusterHandle(mapId, preview);
    }

    void moveDoorHandle(MapId mapId, DungeonEditorSessionValues.MoveHandlePreview preview) {
        session.moveDoorHandle(mapId, preview);
    }

    void moveCorridorHandle(MapId mapId, DungeonEditorSessionValues.MoveHandlePreview preview) {
        session.moveCorridorHandle(mapId, preview);
    }

    void moveStairHandle(MapId mapId, DungeonEditorSessionValues.MoveHandlePreview preview) {
        session.moveStairHandle(mapId, preview);
    }

    void stretchClusterBoundary(MapId mapId, DungeonEditorSessionValues.MoveBoundaryStretchPreview preview) {
        session.stretchClusterBoundary(mapId, preview);
    }

    DungeonEditorSessionEffect corridor(
            InterpretDungeonEditorMainViewInputUseCase.PointerAction action,
            DungeonEditorMainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool corridorTool
    ) {
        return mainViewInterpreter.corridor(
                action,
                input,
                snapshot,
                corridorTool,
                projectionLevel());
    }

    DungeonEditorDoorBoundaryDraftInterpretation doorBoundaryOperation(
            InterpretDungeonEditorMainViewInputUseCase.PointerAction action,
            DungeonEditorMainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool boundaryTool
    ) {
        return mainViewInterpreter.doorBoundaryOperation(
                action,
                input,
                snapshot,
                boundaryTool,
                projectionLevel());
    }

    DungeonEditorWallBoundaryDraftInterpretation wallBoundaryOperation(
            InterpretDungeonEditorMainViewInputUseCase.PointerAction action,
            DungeonEditorMainViewInput input,
            MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool boundaryTool
    ) {
        return mainViewInterpreter.wallBoundaryOperation(
                action,
                input,
                snapshot,
                selection(),
                boundaryTool,
                projectionLevel());
    }

    DungeonEditorRoomPaintInterpretation roomPaintInterpretation(
            InterpretDungeonEditorMainViewInputUseCase.PointerAction action,
            DungeonEditorMainViewInput input,
            DungeonEditorSessionValues.Tool tool
    ) {
        return mainViewInterpreter.roomPaintOperation(
                action,
                input,
                tool,
                projectionLevel());
    }

    DungeonEditorSessionEffect selection(
            InterpretDungeonEditorMainViewInputUseCase.PointerAction action,
            DungeonEditorMainViewInput input,
            @Nullable MapSnapshot snapshot
    ) {
        return mainViewInterpreter.selection(
                action,
                input,
                snapshot,
                selection(),
                projectionLevel());
    }

    DungeonEditorSessionEffect scrollSelection(int projectionLevelDelta) {
        return mainViewInterpreter.scrollSelection(
                projectionLevelDelta,
                projectionLevel(),
                loadCommittedSnapshot());
    }

    Result fromSnapshot(DungeonEditorSessionSnapshot.@Nullable SnapshotData snapshot) {
        return snapshot == null ? Result.publishAfterStateModelSideEffect() : Result.publish();
    }

    Result fromPublication(DungeonEditorRuntimeApplicationService.PublicationResult publication) {
        return fromPublication(null, publication);
    }

    Result fromOperationResult(DungeonAuthoredApplicationService.OperationResult result) {
        return result == null || !result.present()
                ? Result.none()
                : Result.publishAfterStateModelSideEffect();
    }

    Result fromPublication(
            DungeonEditorSessionSnapshot.@Nullable SnapshotData fallbackSnapshot,
            DungeonEditorRuntimeApplicationService.PublicationResult publication
    ) {
        DungeonEditorRuntimeApplicationService.PublicationResult safePublication =
                Objects.requireNonNull(publication, "publication");
        return switch (safePublication.kind()) {
            case CONTROLS -> fromControls(safePublication.controls());
            case FULL_SNAPSHOT -> fromSnapshot(safePublication.snapshot());
            case NONE -> fromSnapshot(fallbackSnapshot);
        };
    }

    Result fromSessionFrame(DungeonEditorSessionSnapshot.@Nullable SessionFrameData frameData) {
        return frameData == null ? Result.publishAfterStateModelSideEffect() : fromControls(frameData.controlsData());
    }

    Result fromControls(DungeonEditorSessionSnapshot.@Nullable ControlsData controls) {
        return controls == null ? Result.publishAfterStateModelSideEffect() : Result.publish();
    }

    private static DungeonAuthoredApplicationService.LabelTargetKind labelTargetKind(
            DungeonEditorRuntimeLabelTarget target
    ) {
        DungeonEditorRuntimeLabelTarget safeTarget = DungeonEditorRuntimeLabelTarget.orEmpty(target);
        return switch (safeTarget.kind()) {
            case ROOM -> DungeonAuthoredApplicationService.LabelTargetKind.ROOM;
            case CLUSTER -> DungeonAuthoredApplicationService.LabelTargetKind.CLUSTER;
            case EMPTY -> DungeonAuthoredApplicationService.LabelTargetKind.EMPTY;
        };
    }

    record Startup(DungeonEditorRuntimeContext context, Result initialResult) {
        Startup {
            context = Objects.requireNonNull(context, "context");
            initialResult = initialResult == null ? Result.none() : initialResult;
        }
    }

    record Result(
            boolean publishRuntimeFrame,
            boolean publishSuppressedStateModelFrame
    ) {
        static Result none() {
            return new Result(false, true);
        }

        static Result publish() {
            return new Result(true, true);
        }

        static Result publishAfterStateModelSideEffect() {
            return new Result(false, true);
        }

        Result merge(Result next) {
            Result safeNext = next == null ? none() : next;
            return new Result(
                    publishRuntimeFrame || safeNext.publishRuntimeFrame(),
                    publishSuppressedStateModelFrame || safeNext.publishSuppressedStateModelFrame());
        }

        boolean shouldPublish(boolean stateModelFrameSuppressed) {
            return publishRuntimeFrame || stateModelFrameSuppressed && publishSuppressedStateModelFrame;
        }
    }
}
