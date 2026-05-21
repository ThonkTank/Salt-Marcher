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

    public void execute(
            boolean hasPosition,
            long mapIdValue,
            String locationKindName,
            long ownerId,
            int tileQ,
            int tileR,
            int tileLevel,
            String headingName,
            String actionId
    ) {
        publishedStateRepository.publishMove(moveDungeonTravelActionUseCase.execute(
                new MoveDungeonTravelActionUseCase.Input(
                        PublishDungeonTravelSurfaceUseCase.travelPosition(
                                hasPosition,
                                mapIdValue,
                                locationKindName,
                                ownerId,
                                tileQ,
                                tileR,
                                tileLevel,
                                headingName),
                        actionId)));
    }
}
