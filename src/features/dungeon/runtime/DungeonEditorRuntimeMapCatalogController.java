package src.features.dungeon.runtime;

import java.util.Objects;

final class DungeonEditorRuntimeMapCatalogController {
    private final DungeonEditorStore store;
    private final DungeonEditorMainViewInteractionState interactionState;
    private final DungeonEditorRuntimeDraftSession draftSession;
    private final DungeonEditorAuthoredRuntimeOperations operationOwner;
    private final DungeonEditorRuntimeFramePublisher framePublisher;

    DungeonEditorRuntimeMapCatalogController(
            DungeonEditorStore store,
            DungeonEditorMainViewInteractionState interactionState,
            DungeonEditorRuntimeDraftSession draftSession,
            DungeonEditorAuthoredRuntimeOperations operationOwner,
            DungeonEditorRuntimeFramePublisher framePublisher
    ) {
        this.store = Objects.requireNonNull(store, "store");
        this.interactionState = Objects.requireNonNull(interactionState, "interactionState");
        this.draftSession = Objects.requireNonNull(draftSession, "draftSession");
        this.operationOwner = Objects.requireNonNull(operationOwner, "operationOwner");
        this.framePublisher = Objects.requireNonNull(framePublisher, "framePublisher");
    }

    void selectMap(long mapIdValue) {
        interactionState.clear();
        draftSession.clearInlineLabelEditSession();
        store.dispatch(new DungeonEditorAction.MarkDraftSessionChanged());
        DungeonEditorRuntimeOperationPublisher.apply(
                store,
                framePublisher,
                () -> operationOwner.selectMap(mapIdValue));
    }

    void createMap(String mapName) {
        interactionState.clear();
        DungeonEditorRuntimeOperationPublisher.apply(
                store,
                framePublisher,
                () -> operationOwner.createMap(mapName));
    }

    void renameMap(long mapIdValue, String mapName) {
        DungeonEditorRuntimeOperationPublisher.apply(
                store,
                framePublisher,
                () -> operationOwner.renameMap(mapIdValue, mapName));
    }

    void deleteMap(long mapIdValue) {
        interactionState.clear();
        DungeonEditorRuntimeOperationPublisher.apply(
                store,
                framePublisher,
                () -> operationOwner.deleteMap(mapIdValue));
    }
}
