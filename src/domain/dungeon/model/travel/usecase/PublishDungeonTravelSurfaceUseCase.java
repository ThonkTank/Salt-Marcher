package src.domain.dungeon.model.travel.usecase;

import java.util.Objects;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;

public final class PublishDungeonTravelSurfaceUseCase {

    private final LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;

    public PublishDungeonTravelSurfaceUseCase(
            LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository
    ) {
        this.loadDungeonTravelSurfaceUseCase =
                Objects.requireNonNull(loadDungeonTravelSurfaceUseCase, "loadDungeonTravelSurfaceUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(ApplyDungeonTravelUseCase.PositionInput position) {
        publishedStateRepository.publishSurface(loadDungeonTravelSurfaceUseCase.execute(
                new LoadDungeonTravelSurfaceUseCase.Input(position == null ? null : position.toFacts())));
    }
}
