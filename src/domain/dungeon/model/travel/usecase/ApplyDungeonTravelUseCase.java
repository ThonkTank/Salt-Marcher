package src.domain.dungeon.model.travel.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonTravelPositionFacts;
import src.domain.dungeon.model.map.repository.DungeonPublishedStateRepository;

public final class ApplyDungeonTravelUseCase {

    private final LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase;
    private final MoveDungeonTravelActionUseCase moveDungeonTravelActionUseCase;
    private final DungeonPublishedStateRepository publishedStateRepository;

    public ApplyDungeonTravelUseCase(
            LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase,
            MoveDungeonTravelActionUseCase moveDungeonTravelActionUseCase,
            DungeonPublishedStateRepository publishedStateRepository
    ) {
        this.loadDungeonTravelSurfaceUseCase =
                Objects.requireNonNull(loadDungeonTravelSurfaceUseCase, "loadDungeonTravelSurfaceUseCase");
        this.moveDungeonTravelActionUseCase =
                Objects.requireNonNull(moveDungeonTravelActionUseCase, "moveDungeonTravelActionUseCase");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void loadSurface(@Nullable DungeonTravelPositionFacts position) {
        publishedStateRepository.publishTravelSurface(loadDungeonTravelSurfaceUseCase.execute(
                new LoadDungeonTravelSurfaceUseCase.Input(position)));
    }

    public void move(@Nullable DungeonTravelPositionFacts position, String actionId) {
        publishedStateRepository.publishTravelMove(moveDungeonTravelActionUseCase.execute(
                new MoveDungeonTravelActionUseCase.Input(position, actionId)));
    }
}
