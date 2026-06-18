package src.domain.dungeon;

import shell.api.ServiceRegistry;

final class DungeonEditorAuthoredUseCasesServiceAssembly {

    private DungeonEditorAuthoredUseCasesServiceAssembly() {
    }

    static AuthoredUseCases create(
            ServiceRegistry registry,
            DungeonAuthoredPublishedStateServiceAssembly publishedState,
            src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState dungeonState
    ) {
        src.domain.dungeon.model.core.usecase.ApplyDungeonMapCatalogUseCase catalogUseCase = mapCatalogUseCase(registry);
        src.domain.dungeon.model.runtime.usecase.LoadDungeonSnapshotUseCase loadSnapshotUseCase = loadDungeonSnapshotUseCase(registry);
        src.domain.dungeon.model.core.repository.DungeonMapRepository repository =
                registry.require(src.domain.dungeon.model.core.repository.DungeonMapRepository.class);
        DungeonEditorSnapshotPartsServiceAssembly snapshotParts = DungeonEditorSnapshotPartsServiceAssembly.create(registry);
        src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorOperationUseCase operationUseCase =
                authoredOperationUseCase(snapshotParts, repository);
        src.domain.dungeon.model.runtime.usecase.ApplyDungeonAuthoredMutationUseCase mutationUseCase =
                new src.domain.dungeon.model.runtime.usecase.ApplyDungeonAuthoredMutationUseCase(
                        operationUseCase,
                        repository);
        src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase =
                new src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorAuthoredMutationUseCase(publishedState, dungeonState);
        return new AuthoredUseCases(
                new src.domain.dungeon.model.runtime.usecase.SearchDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState),
                new src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState),
                new src.domain.dungeon.model.runtime.usecase.RenameDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState),
                new src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorMapCatalogUseCase(catalogUseCase, publishedState, dungeonState),
                new src.domain.dungeon.model.runtime.usecase.LoadDungeonEditorAuthoredMapUseCase(
                        loadSnapshotUseCase,
                        new src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorAuthoredSnapshotUseCase(publishedState, dungeonState),
                        new src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorAuthoredInspectorUseCase(publishedState, dungeonState)),
                new src.domain.dungeon.model.runtime.usecase.PreviewDungeonEditorAuthoredOperationUseCase(
                        mutationUseCase,
                        dungeonState),
                new src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorAuthoredOperationUseCase(
                        mutationUseCase,
                        publishMutationUseCase),
                new src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredRoomNarrationUseCase(
                        mutationUseCase,
                        publishMutationUseCase),
                new src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredLabelNameUseCase(
                        mutationUseCase,
                        publishMutationUseCase),
                new src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredTransitionDescriptionUseCase(
                        operationUseCase,
                        publishMutationUseCase),
                new src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredTransitionLinkUseCase(
                        registry.require(src.domain.dungeon.model.core.repository.DungeonMapRepository.class),
                        snapshotParts.derive(),
                        snapshotParts.assembleDungeonSnapshotUseCase(),
                        snapshotParts.publishDungeonEditorHandlesUseCase(),
                        publishMutationUseCase),
                new src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredStairGeometryUseCase(
                        operationUseCase,
                        snapshotParts.loadDungeonMapUseCase(),
                        publishMutationUseCase),
                new src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorAuthoredStairUseCase(
                        operationUseCase,
                        snapshotParts.loadDungeonMapUseCase(),
                        publishMutationUseCase,
                        repository),
                new src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorAuthoredTransitionUseCase(
                        operationUseCase,
                        snapshotParts.loadDungeonMapUseCase(),
                        publishMutationUseCase,
                        repository),
                new src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorAuthoredFeatureMarkerUseCase(
                        operationUseCase,
                        snapshotParts.loadDungeonMapUseCase(),
                        publishMutationUseCase),
                new src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorAuthoredStairUseCase(
                        snapshotParts.loadDungeonMapUseCase(),
                        operationUseCase,
                        publishMutationUseCase),
                new src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorAuthoredTransitionUseCase(
                        snapshotParts.loadDungeonMapUseCase(),
                        operationUseCase,
                        publishMutationUseCase),
                new src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorAuthoredFeatureMarkerUseCase(
                        snapshotParts.loadDungeonMapUseCase(),
                        operationUseCase,
                        publishMutationUseCase));
    }

    private static src.domain.dungeon.model.core.usecase.ApplyDungeonMapCatalogUseCase mapCatalogUseCase(ServiceRegistry registry) {
        src.domain.dungeon.model.core.repository.DungeonMapRepository repository =
                registry.require(src.domain.dungeon.model.core.repository.DungeonMapRepository.class);
        return new src.domain.dungeon.model.core.usecase.ApplyDungeonMapCatalogUseCase(
                new src.domain.dungeon.model.core.usecase.SearchDungeonMapsUseCase(repository),
                new src.domain.dungeon.model.core.usecase.CreateDungeonMapUseCase(repository),
                new src.domain.dungeon.model.core.usecase.RenameDungeonMapUseCase(repository),
                new src.domain.dungeon.model.core.usecase.DeleteDungeonMapUseCase(repository));
    }

    private static src.domain.dungeon.model.runtime.usecase.LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase(ServiceRegistry registry) {
        DungeonEditorSnapshotPartsServiceAssembly parts = DungeonEditorSnapshotPartsServiceAssembly.create(registry);
        src.domain.dungeon.model.runtime.usecase.InspectDungeonSelectionUseCase inspectDungeonSelectionUseCase =
                new src.domain.dungeon.model.runtime.usecase.InspectDungeonSelectionUseCase(parts.derive());
        return new src.domain.dungeon.model.runtime.usecase.LoadDungeonSnapshotUseCase(
                parts.loadDungeonMapUseCase(),
                parts.assembleDungeonSnapshotUseCase(),
                parts.publishDungeonEditorHandlesUseCase(),
                inspectDungeonSelectionUseCase);
    }

    private static src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorOperationUseCase authoredOperationUseCase(
            DungeonEditorSnapshotPartsServiceAssembly parts,
            src.domain.dungeon.model.core.repository.DungeonMapRepository repository
    ) {
        return new src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorOperationUseCase(
                parts.loadDungeonMapUseCase(),
                repository,
                parts.derive(),
                parts.assembleDungeonSnapshotUseCase(),
                parts.publishDungeonEditorHandlesUseCase());
    }

    record AuthoredUseCases(
            src.domain.dungeon.model.runtime.usecase.SearchDungeonEditorMapCatalogUseCase searchMapsUseCase,
            src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorMapCatalogUseCase createMapUseCase,
            src.domain.dungeon.model.runtime.usecase.RenameDungeonEditorMapCatalogUseCase renameMapUseCase,
            src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorMapCatalogUseCase deleteMapUseCase,
            src.domain.dungeon.model.runtime.usecase.LoadDungeonEditorAuthoredMapUseCase loadMapUseCase,
            src.domain.dungeon.model.runtime.usecase.PreviewDungeonEditorAuthoredOperationUseCase previewOperationUseCase,
            src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorAuthoredOperationUseCase applyOperationUseCase,
            src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredRoomNarrationUseCase saveRoomNarrationUseCase,
            src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredLabelNameUseCase saveLabelNameUseCase,
            src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredTransitionDescriptionUseCase saveTransitionDescriptionUseCase,
            src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredTransitionLinkUseCase saveTransitionLinkUseCase,
            src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorAuthoredStairGeometryUseCase saveStairGeometryUseCase,
            src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorAuthoredStairUseCase createStairUseCase,
            src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorAuthoredTransitionUseCase createTransitionUseCase,
            src.domain.dungeon.model.runtime.usecase.CreateDungeonEditorAuthoredFeatureMarkerUseCase createFeatureMarkerUseCase,
            src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorAuthoredStairUseCase deleteStairUseCase,
            src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorAuthoredTransitionUseCase deleteTransitionUseCase,
            src.domain.dungeon.model.runtime.usecase.DeleteDungeonEditorAuthoredFeatureMarkerUseCase deleteFeatureMarkerUseCase
    ) {
    }
}
