package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorStateModel;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;

final class DungeonEditorRuntimeStatePanelDraftPort implements DungeonEditorStatePanelDraftOperations {
    private final DungeonEditorControlsModel controlsModel;
    private final DungeonEditorStateModel stateModel;
    private final DungeonEditorRuntimeDraftSession draftSession;
    private final DungeonEditorRuntimeFramePublisher framePublisher;
    private final DungeonEditorAuthoredRuntimeOperations operationOwner;

    DungeonEditorRuntimeStatePanelDraftPort(
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
    public void updateStatePanelRoomNarrationDraft(RoomNarrationDraftInput input) {
        draftSession.updateRoomNarrationDraft(currentSelectedMapIdValue(), input);
        framePublisher.publishCurrentToSubscribers();
    }

    @Override
    public void updateStatePanelLabelNameDraft(DungeonEditorRuntimeLabelTarget target, String name) {
        draftSession.updateLabelNameDraft(currentSelectedMapIdValue(), target, name);
        framePublisher.publishCurrentToSubscribers();
    }

    @Override
    public void updateStatePanelCorridorPointDraft(String q, String r) {
        draftSession.updateCorridorPointDraft(currentSelectedMapIdValue(), currentStateSelection(), q, r);
        framePublisher.publishCurrentToSubscribers();
    }

    @Override
    public void moveStatePanelCorridorPoint(int q, int r) {
        draftSession.moveCorridorPoint(currentSelectedMapIdValue(), currentStateSelection(), q, r, operationOwner);
    }

    @Override
    public void updateStatePanelTransitionDescriptionDraft(long transitionId, String description) {
        draftSession.updateTransitionDescriptionDraft(currentSelectedMapIdValue(), transitionId, description);
        framePublisher.publishCurrentToSubscribers();
    }

    @Override
    public void updateStatePanelTransitionDestinationDraft(TransitionDestinationDraftInput input) {
        draftSession.updateTransitionDestinationDraft(
                currentSelectedMapIdValue(),
                controlsModel.current(),
                stateModel.current(),
                input);
        framePublisher.publishCurrentToSubscribers();
    }

    @Override
    public void updateStatePanelStairGeometryDraft(StairGeometryDraftInput input) {
        draftSession.updateStairGeometryDraft(currentSelectedMapIdValue(), input);
        framePublisher.publishCurrentToSubscribers();
    }

    private DungeonEditorStateSnapshot.Selection currentStateSelection() {
        DungeonEditorStateSnapshot state = stateModel.current();
        return state == null ? DungeonEditorStateSnapshot.Selection.empty() : state.selection();
    }

    private long currentSelectedMapIdValue() {
        return DungeonEditorRuntimeDraftSession.selectedMapIdValue(controlsModel.current());
    }
}
