package src.domain.dungeon.model.travel.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTravelHeading;
import src.domain.dungeon.model.map.model.DungeonTravelLocationKind;
import src.domain.dungeon.model.map.model.DungeonTravelPositionFacts;
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
                        travelPosition(input.position()),
                        input.actionId())));
    }

    public record MoveInput(
            PositionInput position,
            String actionId
    ) {
    }

    public record PositionInput(
            boolean present,
            long mapIdValue,
            String locationKindName,
            long ownerId,
            int tileQ,
            int tileR,
            int tileLevel,
            String headingName
    ) {
    }

    private static @Nullable DungeonTravelPositionFacts travelPosition(PositionInput position) {
        if (position == null || !position.present()) {
            return null;
        }
        return new DungeonTravelPositionFacts(
                new DungeonMapIdentity(position.mapIdValue()),
                locationKind(position.locationKindName()),
                position.ownerId(),
                new DungeonCell(position.tileQ(), position.tileR(), position.tileLevel()),
                heading(position.headingName()));
    }

    private static DungeonTravelLocationKind locationKind(String name) {
        try {
            return DungeonTravelLocationKind.valueOf(name == null ? "" : name);
        } catch (IllegalArgumentException ignored) {
            return DungeonTravelLocationKind.TILE;
        }
    }

    private static DungeonTravelHeading heading(String name) {
        return DungeonTravelHeading.parse(name);
    }
}
