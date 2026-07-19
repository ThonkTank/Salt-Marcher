package features.dungeon.application.editor;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import features.dungeon.application.authored.DungeonAuthoredApplicationService;
import features.dungeon.application.editor.DungeonEditorRuntimeApplicationService;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import features.dungeon.domain.core.structure.stair.StairGeometrySpec;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.application.editor.session.DungeonEditorDungeonFacts;
import features.dungeon.application.editor.session.DungeonEditorDungeonState;
import features.dungeon.application.editor.session.DungeonEditorSessionEffect;
import features.dungeon.application.editor.session.DungeonEditorSessionSnapshot;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapId;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.api.DungeonEditorViewMode;
import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.api.editor.DungeonEditorToolSelection;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.api.editor.DungeonEditorViewportInput;

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

    static DungeonEditorRuntimeContext create(
            DungeonEditorRuntimeDependencies dependencies,
            DungeonEditorMainViewInteractionState interactionState
    ) {
        DungeonEditorRuntimeDependencies safeDependencies =
                Objects.requireNonNull(dependencies, "dependencies");
        DungeonEditorMainViewInteractionState safeInteractionState =
                Objects.requireNonNull(interactionState, "interactionState");
        DungeonEditorDungeonState dungeonState = new DungeonEditorDungeonState();
        InterpretDungeonEditorMainViewInputUseCase interpreter =
                new InterpretDungeonEditorMainViewInputUseCase(
                        safeInteractionState,
                        safeDependencies.corridorRoutingPolicy());
        return safeDependencies.editorRuntimeApplicationService().openSession(
                dungeonState,
                runtimeSession -> new DungeonEditorRuntimeContext(runtimeSession, interpreter));
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

    void clearPreviewWithCommandOutcome(DungeonEditorCommandOutcome outcome) {
        session.clearPreviewWithCommandOutcome(outcome);
    }

    void reject(DungeonEditorCommandOutcome.RejectionReason reason) {
        clearPreviewWithCommandOutcome(DungeonEditorCommandOutcome.rejected(reason));
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

    Result reloadMap(long mapIdValue) {
        return fromSnapshot(session.reloadMap(mapIdValue));
    }

    Result setViewport(DungeonEditorViewportInput viewport) {
        return fromSnapshot(session.setViewport(viewport));
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

    Result undo() {
        return fromSnapshot(session.undo());
    }

    Result redo() {
        return fromSnapshot(session.redo());
    }

    Result setViewMode(DungeonEditorViewMode viewMode) {
        return fromSessionFrame(session.setViewMode(viewMode));
    }

    Result setTool(DungeonEditorToolSelection selection) {
        return fromControls(session.setToolControlsOnly(selection));
    }

    Result setToolAndPublishSnapshot(DungeonEditorToolSelection selection) {
        return fromSnapshot(session.setTool(selection));
    }

    Result cancelActivePreviewSession() {
        return fromSnapshot(session.setTool(DungeonEditorToolSelection.select()));
    }

    Result shiftProjectionLevel(int levelShift) {
        return fromSnapshot(session.shiftProjectionLevel(levelShift));
    }

    Result setOverlay(DungeonOverlaySettings overlaySettings) {
        return fromSessionFrame(session.setOverlay(overlaySettings));
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

    Result saveFeatureMarkerSemantics(long markerId, String label, String description) {
        return fromSnapshot(session.saveFeatureMarkerSemantics(
                new DungeonAuthoredApplicationService.FeatureMarkerSemanticsInput(
                        markerId, label, description)));
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
            features.dungeon.domain.core.structure.transition.TransitionDestination destination
    ) {
        return session.canCreateTransition(mapId, anchor, destination);
    }

    void createTransition(
            MapId mapId,
            TransitionAnchor anchor,
            features.dungeon.domain.core.structure.transition.TransitionDestination destination
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
            features.dungeon.domain.core.geometry.Edge edge,
            boolean deleteMode
    ) {
        session.applyDoorBoundary(mapId, clusterId, edge, deleteMode);
    }

    void applyWallBoundary(
            MapId mapId,
            long clusterId,
            java.util.List<features.dungeon.domain.core.geometry.Edge> edges,
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
            DungeonEditorToolAction corridorTool
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
            DungeonEditorToolAction boundaryTool
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
            DungeonEditorToolAction boundaryTool
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
            DungeonEditorToolAction tool
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
        return snapshot == null ? Result.none() : Result.publish();
    }

    Result fromPublication(DungeonEditorRuntimeApplicationService.PublicationResult publication) {
        return fromPublication(null, publication);
    }

    Result fromOperationResult(DungeonAuthoredApplicationService.OperationResult result) {
        return Result.none();
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
        return frameData == null ? Result.none() : fromControls(frameData.controlsData());
    }

    Result fromControls(DungeonEditorSessionSnapshot.@Nullable ControlsData controls) {
        return controls == null ? Result.none() : Result.publish();
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

    record Result(boolean publicationRequested) {
        static Result none() {
            return new Result(false);
        }

        static Result publish() {
            return new Result(true);
        }

        Result merge(Result next) {
            Result safeNext = next == null ? none() : next;
            return new Result(publicationRequested || safeNext.publicationRequested());
        }

        boolean shouldPublish(boolean ownerReadbackChanged) {
            return publicationRequested || ownerReadbackChanged;
        }
    }
}
