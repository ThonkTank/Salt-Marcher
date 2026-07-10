package src.domain.dungeon;

import java.util.List;
import shell.api.ServiceRegistry;
import src.domain.dungeon.published.DungeonAuthoredMutationModel;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadModel;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonMapCatalogModel;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.shared.published.PublishedState;

class DungeonAuthoredPublishedState {

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

    void publishSnapshot(DungeonAuthoredPublication.Snapshot snapshot) {
        if (snapshot != null) {
            authoredRead.publish(new DungeonAuthoredReadResult.CommittedSnapshot(
                    DungeonAuthoredReadProjectionServiceAssembly.snapshot(snapshot)));
        }
    }

    void publishInspector(DungeonAuthoredPublication.Inspector inspector) {
        if (inspector != null) {
            authoredRead.publish(new DungeonAuthoredReadResult.SelectionInspector(
                    DungeonAuthoredReadProjectionServiceAssembly.inspector(inspector)));
        }
    }

    void publishMutation(DungeonAuthoredPublication.Mutation result) {
        if (result != null) {
            authoredMutation.publish(DungeonAuthoredMutationProjectionServiceAssembly.mutation(result));
        }
    }

    void publishSearch(DungeonAuthoredPublication.Catalog result) {
        mapCatalog.publish(DungeonAuthoredCatalogProjectionServiceAssembly.mapList(result));
    }

    void publishCreated(DungeonAuthoredPublication.MapMutation mutation) {
        mapCatalog.publish(DungeonAuthoredCatalogProjectionServiceAssembly.mapMutation(
                DungeonMapCatalogResponse.MutationKind.CREATED,
                mutation));
    }

    void publishRenamed(DungeonAuthoredPublication.MapMutation mutation) {
        mapCatalog.publish(DungeonAuthoredCatalogProjectionServiceAssembly.mapMutation(
                DungeonMapCatalogResponse.MutationKind.RENAMED,
                mutation));
    }

    void publishDeleted(DungeonAuthoredPublication.MapMutation mutation) {
        mapCatalog.publish(DungeonAuthoredCatalogProjectionServiceAssembly.mapMutation(
                DungeonMapCatalogResponse.MutationKind.DELETED,
                mutation));
    }
}
