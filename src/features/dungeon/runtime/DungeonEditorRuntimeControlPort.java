package src.features.dungeon.runtime;

import java.util.List;
import java.util.Objects;

final class DungeonEditorRuntimeControlPort implements DungeonEditorControlOperations {
    private final DungeonEditorMainViewInteractionState interactionState;
    private final DungeonEditorPointerInteractionOperations pointerOperations;
    private final DungeonEditorRuntimeDraftSession draftSession;
    private final DungeonEditorAuthoredRuntimeOperations operationOwner;

    DungeonEditorRuntimeControlPort(
            DungeonEditorMainViewInteractionState interactionState,
            DungeonEditorPointerInteractionOperations pointerOperations,
            DungeonEditorRuntimeDraftSession draftSession,
            DungeonEditorAuthoredRuntimeOperations operationOwner
    ) {
        this.interactionState = Objects.requireNonNull(interactionState, "interactionState");
        this.pointerOperations = Objects.requireNonNull(pointerOperations, "pointerOperations");
        this.draftSession = Objects.requireNonNull(draftSession, "draftSession");
        this.operationOwner = Objects.requireNonNull(operationOwner, "operationOwner");
    }

    @Override
    public void setViewMode(String viewModeKey) {
        interactionState.clear();
        operationOwner.setViewMode(viewModeKey);
    }

    @Override
    public void setTool(String toolKey) {
        interactionState.clear();
        pointerOperations.clearPointerSession();
        draftSession.clearInlineLabelEditSession();
        operationOwner.setTool(toolKey);
    }

    @Override
    public void cancelActivePreviewSession() {
        interactionState.clear();
        pointerOperations.clearPointerSession();
        draftSession.clearInlineLabelEditSession();
        operationOwner.cancelActivePreviewSession();
    }

    @Override
    public void shiftProjectionLevel(int levelShift) {
        operationOwner.shiftProjectionLevel(levelShift);
    }

    @Override
    public void setOverlay(String modeKey, int levelRange, double opacity, List<Integer> selectedLevels) {
        operationOwner.setOverlay(modeKey, levelRange, opacity, selectedLevels);
    }

    @Override
    public void scrollSelection(int levelDelta) {
        operationOwner.scrollSelection(levelDelta);
    }
}
