package src.domain.dungeon;

import src.domain.dungeon.model.runtime.repository.DungeonEditorSnapshotPublishedStateRepository;

final class DungeonEditorPublishedStateServiceAssembly {

    private final DungeonEditorPublishedState publishedState = new DungeonEditorPublishedState();

    DungeonEditorSnapshotPublishedStateRepository repository() {
        return publishedState;
    }

    src.domain.dungeon.published.DungeonEditorControlsModel controlsModel() {
        return publishedState.controlsModel();
    }

    src.domain.dungeon.published.DungeonEditorMapSurfaceModel mapSurfaceModel() {
        return publishedState.mapSurfaceModel();
    }

    src.domain.dungeon.published.DungeonEditorStateModel stateModel() {
        return publishedState.stateModel();
    }
}
