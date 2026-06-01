package src.domain.dungeon;

import shell.api.ServiceRegistry;

final class DungeonEditorAuthoredUseCasesServiceAssembly {

    private DungeonEditorAuthoredUseCasesServiceAssembly() {
    }

    static AuthoredUseCases create(
            ServiceRegistry registry,
            DungeonAuthoredPublishedStateServiceAssembly publishedState,
            src.domain.dungeon.model.worldspace.model.session.model.DungeonEditorDungeonState dungeonState
    ) {
        src.domain.dungeon.model.worldspace.usecase.ApplyDungeonMapCatalogUseCase catalogUseCase = mapCatalogUseCase(registry);
        src.domain.dungeon.model.worldspace.usecase.LoadDungeonSnapshotUseCase loadSnapshotUseCase = loadDungeonSnapshotUseCase(registry);
        src.domain.dungeon.model.worldspace.repository.DungeonMapRepository repository =
                registry.require(src.domain.dungeon.model.worldspace.repository.DungeonMapRepository.class);
        DungeonEditorSnapshotPartsServiceAssembly snapshotParts = DungeonEditorSnapshotPartsServiceAssembly.create(registry);
        src.domain.dungeon.model.worldspace.usecase.ApplyDungeonAuthoredMutationUseCase mutationUseCase = authoredMutationUseCase(registry);
        src.domain.dungeon.model.worldspace.usecase.PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase =
                new src.domain.dungeon.model.worldspace.usecase.PublishDungeonEditorAuthoredMutationUseCase(publishedState, dungeonState);
        return new AuthoredUseCases(
                new src.domain.dungeon.model.worldspace.usecase.SearchDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState),
                new src.domain.dungeon.model.worldspace.usecase.CreateDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState),
                new src.domain.dungeon.model.worldspace.usecase.RenameDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState),
                new src.domain.dungeon.model.worldspace.usecase.DeleteDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState),
                new src.domain.dungeon.model.worldspace.usecase.LoadDungeonEditorAuthoredMapUseCase(
                        loadSnapshotUseCase,
                        new src.domain.dungeon.model.worldspace.usecase.PublishDungeonEditorAuthoredSnapshotUseCase(publishedState, dungeonState),
                        new src.domain.dungeon.model.worldspace.usecase.PublishDungeonEditorAuthoredInspectorUseCase(publishedState, dungeonState)),
                new src.domain.dungeon.model.worldspace.usecase.PreviewDungeonEditorAuthoredOperationUseCase(
                        mutationUseCase,
                        publishMutationUseCase),
                new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorAuthoredOperationUseCase(
                        mutationUseCase,
                        publishMutationUseCase),
                new src.domain.dungeon.model.worldspace.usecase.SaveDungeonEditorAuthoredRoomNarrationUseCase(
                        mutationUseCase,
                        publishMutationUseCase),
                new src.domain.dungeon.model.worldspace.usecase.SaveDungeonEditorAuthoredTransitionDescriptionUseCase(
                        mutationUseCase,
                        publishMutationUseCase),
                new src.domain.dungeon.model.worldspace.usecase.SaveDungeonEditorAuthoredTransitionLinkUseCase(
                        registry.require(src.domain.dungeon.model.worldspace.repository.DungeonMapRepository.class),
                        snapshotParts.derive(),
                        snapshotParts.assembleDungeonSnapshotUseCase(),
                        snapshotParts.publishDungeonEditorHandlesUseCase(),
                        publishMutationUseCase),
                new src.domain.dungeon.model.worldspace.usecase.SaveDungeonEditorAuthoredStairGeometryUseCase(
                        mutationUseCase,
                        publishMutationUseCase),
                new src.domain.dungeon.model.worldspace.usecase.CreateDungeonEditorAuthoredStairUseCase(
                        mutationUseCase,
                        publishMutationUseCase,
                        repository),
                new src.domain.dungeon.model.worldspace.usecase.CreateDungeonEditorAuthoredTransitionUseCase(
                        mutationUseCase,
                        publishMutationUseCase,
                        repository),
                new src.domain.dungeon.model.worldspace.usecase.DeleteDungeonEditorAuthoredStairUseCase(
                        DungeonEditorSnapshotPartsServiceAssembly.create(registry).loadDungeonMapUseCase(),
                        mutationUseCase,
                        publishMutationUseCase),
                new src.domain.dungeon.model.worldspace.usecase.DeleteDungeonEditorAuthoredTransitionUseCase(
                        DungeonEditorSnapshotPartsServiceAssembly.create(registry).loadDungeonMapUseCase(),
                        mutationUseCase,
                        publishMutationUseCase));
    }

    private static src.domain.dungeon.model.worldspace.usecase.ApplyDungeonMapCatalogUseCase mapCatalogUseCase(ServiceRegistry registry) {
        src.domain.dungeon.model.worldspace.repository.DungeonMapRepository repository =
                registry.require(src.domain.dungeon.model.worldspace.repository.DungeonMapRepository.class);
        return new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonMapCatalogUseCase(
                new src.domain.dungeon.model.worldspace.usecase.SearchDungeonMapsUseCase(repository),
                new src.domain.dungeon.model.worldspace.usecase.CreateDungeonMapUseCase(repository),
                new src.domain.dungeon.model.worldspace.usecase.RenameDungeonMapUseCase(repository),
                new src.domain.dungeon.model.worldspace.usecase.DeleteDungeonMapUseCase(repository));
    }

    private static src.domain.dungeon.model.worldspace.usecase.LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase(ServiceRegistry registry) {
        DungeonEditorSnapshotPartsServiceAssembly parts = DungeonEditorSnapshotPartsServiceAssembly.create(registry);
        src.domain.dungeon.model.worldspace.usecase.InspectDungeonSelectionUseCase inspectDungeonSelectionUseCase =
                new src.domain.dungeon.model.worldspace.usecase.InspectDungeonSelectionUseCase(parts.derive());
        return new src.domain.dungeon.model.worldspace.usecase.LoadDungeonSnapshotUseCase(
                parts.loadDungeonMapUseCase(),
                parts.assembleDungeonSnapshotUseCase(),
                parts.publishDungeonEditorHandlesUseCase(),
                inspectDungeonSelectionUseCase);
    }

    private static src.domain.dungeon.model.worldspace.usecase.ApplyDungeonAuthoredMutationUseCase authoredMutationUseCase(
            ServiceRegistry registry
    ) {
        DungeonEditorSnapshotPartsServiceAssembly parts = DungeonEditorSnapshotPartsServiceAssembly.create(registry);
        return new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonAuthoredMutationUseCase(
                new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorOperationUseCase(
                        parts.loadDungeonMapUseCase(),
                        registry.require(src.domain.dungeon.model.worldspace.repository.DungeonMapRepository.class),
                        parts.derive(),
                        parts.assembleDungeonSnapshotUseCase(),
                        parts.publishDungeonEditorHandlesUseCase()),
                registry.require(src.domain.dungeon.model.worldspace.repository.DungeonMapRepository.class));
    }

    record AuthoredUseCases(
            src.domain.dungeon.model.worldspace.usecase.SearchDungeonEditorMapCatalogUseCase searchMapsUseCase,
            src.domain.dungeon.model.worldspace.usecase.CreateDungeonEditorMapCatalogUseCase createMapUseCase,
            src.domain.dungeon.model.worldspace.usecase.RenameDungeonEditorMapCatalogUseCase renameMapUseCase,
            src.domain.dungeon.model.worldspace.usecase.DeleteDungeonEditorMapCatalogUseCase deleteMapUseCase,
            src.domain.dungeon.model.worldspace.usecase.LoadDungeonEditorAuthoredMapUseCase loadMapUseCase,
            src.domain.dungeon.model.worldspace.usecase.PreviewDungeonEditorAuthoredOperationUseCase previewOperationUseCase,
            src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorAuthoredOperationUseCase applyOperationUseCase,
            src.domain.dungeon.model.worldspace.usecase.SaveDungeonEditorAuthoredRoomNarrationUseCase saveRoomNarrationUseCase,
            src.domain.dungeon.model.worldspace.usecase.SaveDungeonEditorAuthoredTransitionDescriptionUseCase saveTransitionDescriptionUseCase,
            src.domain.dungeon.model.worldspace.usecase.SaveDungeonEditorAuthoredTransitionLinkUseCase saveTransitionLinkUseCase,
            src.domain.dungeon.model.worldspace.usecase.SaveDungeonEditorAuthoredStairGeometryUseCase saveStairGeometryUseCase,
            src.domain.dungeon.model.worldspace.usecase.CreateDungeonEditorAuthoredStairUseCase createStairUseCase,
            src.domain.dungeon.model.worldspace.usecase.CreateDungeonEditorAuthoredTransitionUseCase createTransitionUseCase,
            src.domain.dungeon.model.worldspace.usecase.DeleteDungeonEditorAuthoredStairUseCase deleteStairUseCase,
            src.domain.dungeon.model.worldspace.usecase.DeleteDungeonEditorAuthoredTransitionUseCase deleteTransitionUseCase
    ) {
    }
}
