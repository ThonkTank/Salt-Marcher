package src.domain.dungeon;

import shell.api.ServiceRegistry;

record DungeonEditorSnapshotPartsServiceAssembly(
        src.domain.dungeon.model.core.usecase.LoadDungeonMapUseCase loadDungeonMapUseCase,
        src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorHandlesUseCase publishDungeonEditorHandlesUseCase,
        src.domain.dungeon.model.core.usecase.BuildDungeonDerivedStateUseCase derive,
        src.domain.dungeon.model.runtime.usecase.AssembleDungeonSnapshotUseCase assembleDungeonSnapshotUseCase
) {

    static DungeonEditorSnapshotPartsServiceAssembly create(ServiceRegistry registry) {
        src.domain.dungeon.model.core.usecase.BuildDungeonDerivedStateUseCase derive =
                new src.domain.dungeon.model.core.usecase.BuildDungeonDerivedStateUseCase();
        return new DungeonEditorSnapshotPartsServiceAssembly(
                new src.domain.dungeon.model.core.usecase.LoadDungeonMapUseCase(
                        registry.require(src.domain.dungeon.model.core.repository.DungeonMapRepository.class)),
                new src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorHandlesUseCase(),
                derive,
                new src.domain.dungeon.model.runtime.usecase.AssembleDungeonSnapshotUseCase(derive));
    }
}
