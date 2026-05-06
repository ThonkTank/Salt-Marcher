package src.domain.dungeon.application;

import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.port.DungeonMapSearch;

final class DungeonAuthoredRuntimeAccess {

    private DungeonAuthoredRuntimeAccess() {
    }

    static DungeonAuthoredRuntimeAdapter create(
            DungeonMapRepository repository,
            DungeonMapSearch search
    ) {
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        LoadDungeonMapUseCase loadDungeonMapUseCase = new LoadDungeonMapUseCase(repository, search);
        PublishDungeonEditorHandlesUseCase publishDungeonEditorHandlesUseCase =
                new PublishDungeonEditorHandlesUseCase();
        AssembleDungeonSnapshotUseCase assembleDungeonSnapshotUseCase =
                new AssembleDungeonSnapshotUseCase(derive);
        InspectDungeonSelectionUseCase inspectDungeonSelectionUseCase =
                new InspectDungeonSelectionUseCase(derive);
        LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase = new LoadDungeonSnapshotUseCase(
                loadDungeonMapUseCase,
                assembleDungeonSnapshotUseCase,
                publishDungeonEditorHandlesUseCase,
                inspectDungeonSelectionUseCase);
        return new DungeonAuthoredRuntimeAdapter(
                loadDungeonSnapshotUseCase,
                new ApplyDungeonEditorOperationUseCase(
                        loadDungeonMapUseCase,
                        repository::save,
                        derive::execute,
                        assembleDungeonSnapshotUseCase,
                        publishDungeonEditorHandlesUseCase));
    }
}
