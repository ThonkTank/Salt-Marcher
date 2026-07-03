package src.features.dungeon.runtime;

import java.util.Objects;

final class DungeonEditorRuntimeInlineLabelPort implements DungeonEditorInlineLabelOperations {
    private final DungeonEditorRuntimeDraftSession draftSession;
    private final DungeonEditorRuntimeFramePublisher framePublisher;
    private final DungeonEditorTransitionStairOperations transitionStairOperations;

    DungeonEditorRuntimeInlineLabelPort(
            DungeonEditorRuntimeDraftSession draftSession,
            DungeonEditorRuntimeFramePublisher framePublisher,
            DungeonEditorTransitionStairOperations transitionStairOperations
    ) {
        this.draftSession = Objects.requireNonNull(draftSession, "draftSession");
        this.framePublisher = Objects.requireNonNull(framePublisher, "framePublisher");
        this.transitionStairOperations = Objects.requireNonNull(
                transitionStairOperations,
                "transitionStairOperations");
    }

    @Override
    public void beginInlineLabelEdit(DungeonEditorInlineLabelEditSession session) {
        draftSession.beginInlineLabelEdit(session);
        framePublisher.publishDraftSessionChanged();
    }

    @Override
    public void updateInlineLabelEditDraft(String text) {
        draftSession.updateInlineLabelEditDraft(text);
        framePublisher.publishDraftSessionChanged();
    }

    @Override
    public void cancelInlineLabelEdit() {
        draftSession.clearInlineLabelEditSession();
        framePublisher.publishDraftSessionChanged();
    }

    @Override
    public void commitInlineLabelEdit(String text) {
        DungeonEditorInlineLabelEditSession editSession = draftSession.takeInlineLabelEditSession();
        framePublisher.publishDraftSessionChanged();
        if (!editSession.active() || !editSession.target().present() || text == null || text.isBlank()) {
            return;
        }
        transitionStairOperations.saveLabelName(editSession.target(), text);
    }
}
