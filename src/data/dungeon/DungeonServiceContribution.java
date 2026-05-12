package src.data.dungeon;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.dungeon.repository.DungeonPublishedStateRepositoryAdapter;
import src.data.dungeon.repository.SqliteDungeonMapRepository;
import src.domain.dungeon.application.ApplyDungeonAuthoredMutationUseCase;
import src.domain.dungeon.application.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.application.ApplyDungeonMapCatalogUseCase;
import src.domain.dungeon.application.ApplyDungeonTravelUseCase;
import src.domain.dungeon.application.AssembleDungeonSnapshotUseCase;
import src.domain.dungeon.application.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.application.CreateDungeonMapUseCase;
import src.domain.dungeon.application.DeleteDungeonMapUseCase;
import src.domain.dungeon.application.InspectDungeonSelectionUseCase;
import src.domain.dungeon.application.LoadDungeonMapUseCase;
import src.domain.dungeon.application.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.application.LoadDungeonTravelSurfaceUseCase;
import src.domain.dungeon.application.MoveDungeonTravelActionUseCase;
import src.domain.dungeon.application.PublishDungeonEditorHandlesUseCase;
import src.domain.dungeon.application.RefreshDungeonAuthoredUseCase;
import src.domain.dungeon.application.RenameDungeonMapUseCase;
import src.domain.dungeon.application.SearchDungeonMapsUseCase;
import src.domain.dungeon.DungeonAuthoredApplicationService;
import src.domain.dungeon.DungeonCatalogApplicationService;
import src.domain.dungeon.DungeonTravelApplicationService;
import src.domain.dungeon.published.DungeonAuthoredMutationModel;
import src.domain.dungeon.published.DungeonAuthoredReadModel;
import src.domain.dungeon.published.DungeonMapCatalogModel;
import src.domain.dungeon.published.DungeonTravelModel;

public final class DungeonServiceContribution implements ServiceContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public DungeonServiceContribution() {
    }

    @Override
    public void register(ServiceRegistry.Builder services) {
        SqliteDungeonMapRepository repository = new SqliteDungeonMapRepository();
        DungeonPublishedStateRepositoryAdapter publishedState = new DungeonPublishedStateRepositoryAdapter();
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        LoadDungeonMapUseCase loadDungeonMapUseCase = new LoadDungeonMapUseCase(repository);
        PublishDungeonEditorHandlesUseCase publishDungeonEditorHandlesUseCase = new PublishDungeonEditorHandlesUseCase();
        AssembleDungeonSnapshotUseCase assembleDungeonSnapshotUseCase = new AssembleDungeonSnapshotUseCase(derive);
        InspectDungeonSelectionUseCase inspectDungeonSelectionUseCase = new InspectDungeonSelectionUseCase(derive);
        LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase = new LoadDungeonSnapshotUseCase(
                loadDungeonMapUseCase,
                assembleDungeonSnapshotUseCase,
                publishDungeonEditorHandlesUseCase,
                inspectDungeonSelectionUseCase);
        ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase = new ApplyDungeonEditorOperationUseCase(
                loadDungeonMapUseCase,
                repository,
                derive,
                assembleDungeonSnapshotUseCase,
                publishDungeonEditorHandlesUseCase);
        RefreshDungeonAuthoredUseCase refreshDungeonAuthoredUseCase =
                new RefreshDungeonAuthoredUseCase(loadDungeonSnapshotUseCase, publishedState);
        ApplyDungeonAuthoredMutationUseCase applyDungeonAuthoredMutationUseCase =
                new ApplyDungeonAuthoredMutationUseCase(applyDungeonEditorOperationUseCase, publishedState);
        ApplyDungeonMapCatalogUseCase applyDungeonMapCatalogUseCase = new ApplyDungeonMapCatalogUseCase(
                new SearchDungeonMapsUseCase(repository),
                new CreateDungeonMapUseCase(repository),
                new RenameDungeonMapUseCase(repository),
                new DeleteDungeonMapUseCase(repository),
                publishedState);
        ApplyDungeonTravelUseCase applyDungeonTravelUseCase = new ApplyDungeonTravelUseCase(
                new LoadDungeonTravelSurfaceUseCase(loadDungeonMapUseCase, derive),
                new MoveDungeonTravelActionUseCase(loadDungeonMapUseCase, repository, derive),
                publishedState);
        services.registerFactory(
                DungeonAuthoredApplicationService.class,
                registry -> new DungeonAuthoredApplicationService(
                        refreshDungeonAuthoredUseCase,
                        applyDungeonAuthoredMutationUseCase));
        services.registerFactory(
                DungeonCatalogApplicationService.class,
                registry -> new DungeonCatalogApplicationService(applyDungeonMapCatalogUseCase));
        services.registerFactory(
                DungeonTravelApplicationService.class,
                registry -> new DungeonTravelApplicationService(applyDungeonTravelUseCase));
        services.register(DungeonAuthoredReadModel.class, publishedState.authoredReadModel);
        services.register(DungeonAuthoredMutationModel.class, publishedState.authoredMutationModel);
        services.register(DungeonMapCatalogModel.class, publishedState.mapCatalogModel);
        services.register(DungeonTravelModel.class, publishedState.travelModel);
    }
}
