package src.domain.dungeon;

import shell.api.ServiceRegistry;

record DungeonEditorSnapshotPartsServiceAssembly(
        src.domain.dungeon.model.worldspace.usecase.LoadDungeonMapUseCase loadDungeonMapUseCase,
        src.domain.dungeon.model.worldspace.usecase.PublishDungeonEditorHandlesUseCase publishDungeonEditorHandlesUseCase,
        src.domain.dungeon.model.worldspace.usecase.BuildDungeonDerivedStateUseCase derive,
        src.domain.dungeon.model.worldspace.usecase.AssembleDungeonSnapshotUseCase assembleDungeonSnapshotUseCase
) {

    static DungeonEditorSnapshotPartsServiceAssembly create(ServiceRegistry registry) {
        src.domain.dungeon.model.worldspace.usecase.BuildDungeonDerivedStateUseCase derive =
                new src.domain.dungeon.model.worldspace.usecase.BuildDungeonDerivedStateUseCase();
        return new DungeonEditorSnapshotPartsServiceAssembly(
                new src.domain.dungeon.model.worldspace.usecase.LoadDungeonMapUseCase(
                        registry.require(src.domain.dungeon.model.core.repository.DungeonMapRepository.class)),
                new src.domain.dungeon.model.worldspace.usecase.PublishDungeonEditorHandlesUseCase(),
                derive,
                new src.domain.dungeon.model.worldspace.usecase.AssembleDungeonSnapshotUseCase(derive));
    }
}
