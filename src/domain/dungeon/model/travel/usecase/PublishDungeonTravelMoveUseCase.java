package src.domain.dungeon.model.travel.usecase;

import java.util.Objects;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;

public final class PublishDungeonTravelMoveUseCase {

    private final MoveDungeonTravelActionUseCase moveDungeonTravelActionUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;

    public PublishDungeonTravelMoveUseCase(
            MoveDungeonTravelActionUseCase moveDungeonTravelActionUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository
    ) {
        this.moveDungeonTravelActionUseCase =
                Objects.requireNonNull(moveDungeonTravelActionUseCase, "moveDungeonTravelActionUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(MoveInput input) {
        Objects.requireNonNull(input, "input");
        publishedStateRepository.publishMove(moveDungeonTravelActionUseCase.execute(
                new MoveDungeonTravelActionUseCase.Input(
                        input.position() == null ? null : input.position().toFacts(),
                        input.actionId())));
    }

    public record MoveInput(
            ApplyDungeonTravelUseCase.PositionInput position,
            String actionId
    ) {
    }
}
