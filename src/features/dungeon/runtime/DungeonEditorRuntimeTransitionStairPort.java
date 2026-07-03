package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorStateModel;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;

final class DungeonEditorRuntimeTransitionStairPort implements DungeonEditorTransitionStairOperations {
    private final DungeonEditorControlsModel controlsModel;
    private final DungeonEditorStateModel stateModel;
    private final DungeonEditorRuntimeDraftSession draftSession;
    private final DungeonEditorRuntimeFramePublisher framePublisher;
    private final DungeonEditorAuthoredRuntimeOperations operationOwner;
    private final DungeonEditorStore store;

    DungeonEditorRuntimeTransitionStairPort(
            DungeonEditorControlsModel controlsModel,
            DungeonEditorStateModel stateModel,
            DungeonEditorRuntimeDraftSession draftSession,
            DungeonEditorRuntimeFramePublisher framePublisher,
            DungeonEditorAuthoredRuntimeOperations operationOwner,
            DungeonEditorStore store
    ) {
        this.controlsModel = Objects.requireNonNull(controlsModel, "controlsModel");
        this.stateModel = Objects.requireNonNull(stateModel, "stateModel");
        this.draftSession = Objects.requireNonNull(draftSession, "draftSession");
        this.framePublisher = Objects.requireNonNull(framePublisher, "framePublisher");
        this.operationOwner = Objects.requireNonNull(operationOwner, "operationOwner");
        this.store = Objects.requireNonNull(store, "store");
    }

    @Override
    public void saveRoomNarration(RoomNarration narration) {
        long roomId = narration == null ? 0L : narration.roomId();
        draftSession.clearRoomNarrationDraft(currentSelectedMapIdValue(), roomId);
        framePublisher.markDraftSessionChanged();
        DungeonEditorRuntimeOperationPublisher.apply(
                store,
                framePublisher,
                () -> operationOwner.saveRoomNarration(narration));
    }

    @Override
    public void saveLabelName(DungeonEditorRuntimeLabelTarget target, String name) {
        DungeonEditorRuntimeLabelTarget safeTarget = DungeonEditorRuntimeLabelTarget.orEmpty(target);
        draftSession.clearLabelNameDraft(currentSelectedMapIdValue(), safeTarget);
        framePublisher.markDraftSessionChanged();
        DungeonEditorRuntimeOperationPublisher.apply(
                store,
                framePublisher,
                () -> operationOwner.saveLabelName(safeTarget, name));
    }

    @Override
    public void saveTransitionLink(
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        long selectedMapIdValue = currentSelectedMapIdValue();
        DungeonEditorRuntimeOperationPublisher.apply(
                store,
                framePublisher,
                () -> operationOwner.saveTransitionLink(
                        sourceTransitionId,
                        targetMapId,
                        targetTransitionId,
                        bidirectional),
                result -> clearTransitionDestinationDraftWhenCommitted(
                        selectedMapIdValue,
                        sourceTransitionId,
                        result));
    }

    @Override
    public void saveTransitionDescription(long transitionId, String description) {
        draftSession.clearTransitionDescriptionDraft(currentSelectedMapIdValue(), transitionId);
        framePublisher.markDraftSessionChanged();
        DungeonEditorRuntimeOperationPublisher.apply(
                store,
                framePublisher,
                () -> operationOwner.saveTransitionDescription(transitionId, description));
    }

    @Override
    public void saveStairGeometry(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        draftSession.clearStairGeometryDraft(currentSelectedMapIdValue(), stairId);
        framePublisher.markDraftSessionChanged();
        DungeonEditorRuntimeOperationPublisher.apply(
                store,
                framePublisher,
                () -> operationOwner.saveStairGeometry(
                        stairId,
                        shapeName,
                        directionName,
                        dimension1,
                        dimension2));
    }

    private boolean transitionLinkCommitted(
            long sourceTransitionId,
            DungeonEditorRuntimeOperationResult result
    ) {
        DungeonEditorStateSnapshot state = stateModel.current();
        return DungeonEditorRuntimeDraftSession.selectedTransitionId(state == null ? null : state.selection())
                == sourceTransitionId
                && result != null
                && result.shouldPublish(false);
    }

    private void clearTransitionDestinationDraftWhenCommitted(
            long selectedMapIdValue,
            long sourceTransitionId,
            DungeonEditorRuntimeOperationResult result
    ) {
        if (transitionLinkCommitted(sourceTransitionId, result)) {
            draftSession.clearTransitionDestinationDraft(selectedMapIdValue, sourceTransitionId);
            framePublisher.markDraftSessionChanged();
        }
    }

    private long currentSelectedMapIdValue() {
        return DungeonEditorRuntimeDraftSession.selectedMapIdValue(controlsModel.current());
    }
}
