package src.domain.dungeon.model.map.usecase;

import java.util.Objects;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;

public final class PublishDungeonMapCatalogDeleteUseCase {

    private final DeleteDungeonMapUseCase deleteDungeonMapUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;

    public PublishDungeonMapCatalogDeleteUseCase(
            DeleteDungeonMapUseCase deleteDungeonMapUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository
    ) {
        this.deleteDungeonMapUseCase = Objects.requireNonNull(deleteDungeonMapUseCase, "deleteDungeonMapUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(long mapIdValue) {
        publishedStateRepository.publishDeleted(mapMutation(
                deleteDungeonMapUseCase.execute(new DungeonMapIdentity(mapIdValue))));
    }

    private static DungeonAuthoredPublishedStateRepository.MapMutationPublication mapMutation(
            DungeonMapIdentity mapId
    ) {
        return new DungeonAuthoredPublishedStateRepository.MapMutationPublication(mapId);
    }
}
