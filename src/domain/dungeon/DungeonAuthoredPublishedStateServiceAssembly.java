package src.domain.dungeon;

import java.util.List;

final class DungeonAuthoredPublishedStateServiceAssembly implements src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository {

    private final DungeonPublishedChannelServiceAssembly<src.domain.dungeon.published.DungeonAuthoredReadResult> authoredRead =
            new DungeonPublishedChannelServiceAssembly<>(DungeonAuthoredReadProjectionServiceAssembly.defaultRead());
    private final DungeonPublishedChannelServiceAssembly<src.domain.dungeon.published.DungeonAuthoredMutationResult> authoredMutation =
            new DungeonPublishedChannelServiceAssembly<>(DungeonAuthoredMutationProjectionServiceAssembly.defaultMutation());
    private final DungeonPublishedChannelServiceAssembly<src.domain.dungeon.published.DungeonMapCatalogResponse> mapCatalog =
            new DungeonPublishedChannelServiceAssembly<>(new src.domain.dungeon.published.DungeonMapCatalogResponse.MapList(List.of()));
    final src.domain.dungeon.published.DungeonAuthoredReadModel authoredReadModel =
            new src.domain.dungeon.published.DungeonAuthoredReadModel(authoredRead::current, authoredRead::subscribe);
    final src.domain.dungeon.published.DungeonAuthoredMutationModel authoredMutationModel =
            new src.domain.dungeon.published.DungeonAuthoredMutationModel(authoredMutation::current, authoredMutation::subscribe);
    final src.domain.dungeon.published.DungeonMapCatalogModel mapCatalogModel =
            new src.domain.dungeon.published.DungeonMapCatalogModel(mapCatalog::current, mapCatalog::subscribe);

    void registerModels(shell.api.ServiceRegistry.Builder services) {
        services.registerFactory(
                src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.class,
                registry -> this);
        services.registerFactory(
                src.domain.dungeon.published.DungeonAuthoredReadModel.class,
                registry -> authoredReadModel);
        services.registerFactory(
                src.domain.dungeon.published.DungeonAuthoredMutationModel.class,
                registry -> authoredMutationModel);
        services.registerFactory(
                src.domain.dungeon.published.DungeonMapCatalogModel.class,
                registry -> mapCatalogModel);
    }

    @Override
    public void publishSnapshot(src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.SnapshotPublication snapshot) {
        if (snapshot != null) {
            authoredRead.publish(new src.domain.dungeon.published.DungeonAuthoredReadResult.CommittedSnapshot(
                    DungeonAuthoredReadProjectionServiceAssembly.snapshot(snapshot)));
        }
    }

    @Override
    public void publishInspector(src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.InspectorPublication inspector) {
        if (inspector != null) {
            authoredRead.publish(new src.domain.dungeon.published.DungeonAuthoredReadResult.SelectionInspector(
                    DungeonAuthoredReadProjectionServiceAssembly.inspector(inspector)));
        }
    }

    @Override
    public void publishMutation(src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.MutationPublication result) {
        if (result != null) {
            authoredMutation.publish(DungeonAuthoredMutationProjectionServiceAssembly.mutation(result));
        }
    }

    @Override
    public void publishSearch(src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.CatalogPublication result) {
        mapCatalog.publish(DungeonAuthoredCatalogProjectionServiceAssembly.mapList(result));
    }

    @Override
    public void publishCreated(src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.MapMutationPublication mutation) {
        mapCatalog.publish(DungeonAuthoredCatalogProjectionServiceAssembly.mapMutation(
                src.domain.dungeon.published.DungeonMapCatalogResponse.MutationKind.CREATED,
                mutation.mapId()));
    }

    @Override
    public void publishRenamed(src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.MapMutationPublication mutation) {
        mapCatalog.publish(DungeonAuthoredCatalogProjectionServiceAssembly.mapMutation(
                src.domain.dungeon.published.DungeonMapCatalogResponse.MutationKind.RENAMED,
                mutation.mapId()));
    }

    @Override
    public void publishDeleted(src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.MapMutationPublication mutation) {
        mapCatalog.publish(DungeonAuthoredCatalogProjectionServiceAssembly.mapMutation(
                src.domain.dungeon.published.DungeonMapCatalogResponse.MutationKind.DELETED,
                mutation.mapId()));
    }

}
