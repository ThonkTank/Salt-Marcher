package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import src.domain.dungeon.model.worldspace.model.DungeonTravelPositionFacts;
import src.domain.dungeon.model.worldspace.repository.DungeonAuthoredPublishedStateRepository;

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
            PositionInput position,
            String actionId
    ) {
    }

    public static final class PositionInput {
        private final DungeonTravelPublicationPosition position;

        public PositionInput(
                long mapId,
                String locationKind,
                long ownerId,
                int q,
                int r,
                int level,
                String heading
        ) {
            this.position = DungeonTravelPublicationPosition.fromNames(
                    mapId,
                    locationKind,
                    ownerId,
                    q,
                    r,
                    level,
                    heading);
        }

        DungeonTravelPositionFacts toFacts() {
            return position.toFacts();
        }
    }
}
