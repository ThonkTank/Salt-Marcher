package src.domain.dungeon.model.map.usecase;

import java.util.Objects;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;

public final class PublishDungeonMapCatalogRenameUseCase {

    private final RenameDungeonMapUseCase renameDungeonMapUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;

    public PublishDungeonMapCatalogRenameUseCase(
            RenameDungeonMapUseCase renameDungeonMapUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository
    ) {
        this.renameDungeonMapUseCase = Objects.requireNonNull(renameDungeonMapUseCase, "renameDungeonMapUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(long mapIdValue, String mapName) {
        DungeonMapIdentity mapId = new DungeonMapIdentity(mapIdValue);
        publishedStateRepository.publishRenamed(mapMutation(
                renameDungeonMapUseCase.execute(mapId, mapName).mapId()));
    }

    private static DungeonAuthoredPublishedStateRepository.MapMutationPublication mapMutation(
            DungeonMapIdentity mapId
    ) {
        return new DungeonAuthoredPublishedStateRepository.MapMutationPublication(mapId);
    }
}
