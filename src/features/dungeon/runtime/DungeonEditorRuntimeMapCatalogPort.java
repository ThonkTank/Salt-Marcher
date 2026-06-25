package src.features.dungeon.runtime;

import java.util.Objects;

final class DungeonEditorRuntimeMapCatalogPort implements DungeonEditorMapCatalogOperations {
    private final DungeonEditorMainViewInteractionState interactionState;
    private final DungeonEditorRuntimeDraftSession draftSession;
    private final DungeonEditorAuthoredRuntimeOperations operationOwner;

    DungeonEditorRuntimeMapCatalogPort(
            DungeonEditorMainViewInteractionState interactionState,
            DungeonEditorRuntimeDraftSession draftSession,
            DungeonEditorAuthoredRuntimeOperations operationOwner
    ) {
        this.interactionState = Objects.requireNonNull(interactionState, "interactionState");
        this.draftSession = Objects.requireNonNull(draftSession, "draftSession");
        this.operationOwner = Objects.requireNonNull(operationOwner, "operationOwner");
    }

    @Override
    public void selectMap(long mapIdValue) {
        interactionState.clear();
        draftSession.clearInlineLabelEditSession();
        operationOwner.selectMap(mapIdValue);
    }

    @Override
    public void createMap(String mapName) {
        interactionState.clear();
        operationOwner.createMap(mapName);
    }

    @Override
    public void renameMap(long mapIdValue, String mapName) {
        operationOwner.renameMap(mapIdValue, mapName);
    }

    @Override
    public void deleteMap(long mapIdValue) {
        interactionState.clear();
        operationOwner.deleteMap(mapIdValue);
    }
}
