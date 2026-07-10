package src.domain.dungeon;

import java.util.List;
import shell.api.ServiceRegistry;
import src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.published.DungeonAuthoredMutationModel;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadModel;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonMapCatalogModel;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.shared.published.PublishedState;

class DungeonAuthoredPublishedState implements DungeonAuthoredPublishedStateRepository {

    private final PublishedState<DungeonAuthoredReadResult> authoredRead =
            new PublishedState<>(DungeonAuthoredReadProjectionServiceAssembly.defaultRead());
    private final PublishedState<DungeonAuthoredMutationResult> authoredMutation =
            new PublishedState<>(DungeonAuthoredMutationProjectionServiceAssembly.defaultMutation());
    private final PublishedState<DungeonMapCatalogResponse> mapCatalog =
            new PublishedState<>(new DungeonMapCatalogResponse.MapList(List.of()));
    private final DungeonAuthoredReadModel authoredReadModel =
            new DungeonAuthoredReadModel(authoredRead::current, authoredRead::subscribe);
    private final DungeonAuthoredMutationModel authoredMutationModel =
            new DungeonAuthoredMutationModel(authoredMutation::current, authoredMutation::subscribe);
    private final DungeonMapCatalogModel mapCatalogModel =
            new DungeonMapCatalogModel(mapCatalog::current, mapCatalog::subscribe);

    void registerModels(ServiceRegistry.Builder services) {
        services.registerFactory(DungeonAuthoredReadModel.class, registry -> authoredReadModel);
        services.registerFactory(DungeonAuthoredMutationModel.class, registry -> authoredMutationModel);
        services.registerFactory(DungeonMapCatalogModel.class, registry -> mapCatalogModel);
    }

    @Override
    public void publishSnapshot(SnapshotPublication snapshot) {
        if (snapshot != null) {
            authoredRead.publish(new DungeonAuthoredReadResult.CommittedSnapshot(
                    DungeonAuthoredReadProjectionServiceAssembly.snapshot(
                            DungeonAuthoredPublication.snapshot(snapshot))));
        }
    }

    @Override
    public void publishInspector(InspectorPublication inspector) {
        if (inspector != null) {
            authoredRead.publish(new DungeonAuthoredReadResult.SelectionInspector(
                    DungeonAuthoredReadProjectionServiceAssembly.inspector(
                            DungeonAuthoredPublication.inspector(inspector))));
        }
    }

    @Override
    public void publishMutation(MutationPublication result) {
        if (result != null) {
            authoredMutation.publish(DungeonAuthoredMutationProjectionServiceAssembly.mutation(
                    DungeonAuthoredPublication.mutation(result)));
        }
    }

    @Override
    public void publishSearch(CatalogPublication result) {
        mapCatalog.publish(DungeonAuthoredCatalogProjectionServiceAssembly.mapList(
                DungeonAuthoredPublication.catalog(result)));
    }

    @Override
    public void publishCreated(MapMutationPublication mutation) {
        mapCatalog.publish(DungeonAuthoredCatalogProjectionServiceAssembly.mapMutation(
                DungeonMapCatalogResponse.MutationKind.CREATED,
                DungeonAuthoredPublication.mapMutation(mutation)));
    }

    @Override
    public void publishRenamed(MapMutationPublication mutation) {
        mapCatalog.publish(DungeonAuthoredCatalogProjectionServiceAssembly.mapMutation(
                DungeonMapCatalogResponse.MutationKind.RENAMED,
                DungeonAuthoredPublication.mapMutation(mutation)));
    }

    @Override
    public void publishDeleted(MapMutationPublication mutation) {
        mapCatalog.publish(DungeonAuthoredCatalogProjectionServiceAssembly.mapMutation(
                DungeonMapCatalogResponse.MutationKind.DELETED,
                DungeonAuthoredPublication.mapMutation(mutation)));
    }
}
