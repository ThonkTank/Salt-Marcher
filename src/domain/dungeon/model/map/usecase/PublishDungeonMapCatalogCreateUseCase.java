package src.domain.dungeon.model.map.usecase;

import java.util.Objects;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;

public final class PublishDungeonMapCatalogCreateUseCase {

    private final CreateDungeonMapUseCase createDungeonMapUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;

    public PublishDungeonMapCatalogCreateUseCase(
            CreateDungeonMapUseCase createDungeonMapUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository
    ) {
        this.createDungeonMapUseCase = Objects.requireNonNull(createDungeonMapUseCase, "createDungeonMapUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(String mapName) {
        publishedStateRepository.publishCreated(mapMutation(createDungeonMapUseCase.execute(mapName).mapId()));
    }

    private static DungeonAuthoredPublishedStateRepository.MapMutationPublication mapMutation(
            DungeonMapIdentity mapId
    ) {
        return new DungeonAuthoredPublishedStateRepository.MapMutationPublication(mapId);
    }
}
