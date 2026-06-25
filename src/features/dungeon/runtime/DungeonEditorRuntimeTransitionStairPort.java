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

    DungeonEditorRuntimeTransitionStairPort(
            DungeonEditorControlsModel controlsModel,
            DungeonEditorStateModel stateModel,
            DungeonEditorRuntimeDraftSession draftSession,
            DungeonEditorRuntimeFramePublisher framePublisher,
            DungeonEditorAuthoredRuntimeOperations operationOwner
    ) {
        this.controlsModel = Objects.requireNonNull(controlsModel, "controlsModel");
        this.stateModel = Objects.requireNonNull(stateModel, "stateModel");
        this.draftSession = Objects.requireNonNull(draftSession, "draftSession");
        this.framePublisher = Objects.requireNonNull(framePublisher, "framePublisher");
        this.operationOwner = Objects.requireNonNull(operationOwner, "operationOwner");
    }

    @Override
    public void saveRoomNarration(RoomNarration narration) {
        long roomId = narration == null ? 0L : narration.roomId();
        draftSession.clearRoomNarrationDraft(currentSelectedMapIdValue(), roomId);
        operationOwner.saveRoomNarration(narration);
    }

    @Override
    public void saveLabelName(DungeonEditorRuntimeLabelTarget target, String name) {
        DungeonEditorRuntimeLabelTarget safeTarget = DungeonEditorRuntimeLabelTarget.orEmpty(target);
        draftSession.clearLabelNameDraft(currentSelectedMapIdValue(), safeTarget);
        operationOwner.saveLabelName(safeTarget, name);
    }

    @Override
    public void saveTransitionLink(
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        long selectedMapIdValue = currentSelectedMapIdValue();
        operationOwner.saveTransitionLink(sourceTransitionId, targetMapId, targetTransitionId, bidirectional);
        if (transitionLinkCommitted(sourceTransitionId, targetMapId, targetTransitionId)) {
            draftSession.clearTransitionDestinationDraft(selectedMapIdValue, sourceTransitionId);
            framePublisher.publishCurrentToSubscribers();
        }
    }

    @Override
    public void saveTransitionDescription(long transitionId, String description) {
        draftSession.clearTransitionDescriptionDraft(currentSelectedMapIdValue(), transitionId);
        operationOwner.saveTransitionDescription(transitionId, description);
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
        operationOwner.saveStairGeometry(stairId, shapeName, directionName, dimension1, dimension2);
    }

    private boolean transitionLinkCommitted(long sourceTransitionId, long targetMapId, long targetTransitionId) {
        DungeonEditorStateSnapshot state = stateModel.current();
        return DungeonEditorRuntimeDraftSession.selectedTransitionId(state == null ? null : state.selection())
                == sourceTransitionId
                && DungeonEditorTransitionLinkCommitEvidence.matches(
                state == null ? null : state.inspector(),
                targetMapId,
                targetTransitionId);
    }

    private long currentSelectedMapIdValue() {
        return DungeonEditorRuntimeDraftSession.selectedMapIdValue(controlsModel.current());
    }
}
