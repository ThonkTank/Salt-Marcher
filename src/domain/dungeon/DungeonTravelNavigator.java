package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.runtime.repository.TravelPartyPositionRepository;
import src.domain.dungeon.model.runtime.repository.TravelPartyStateRepository;
import src.domain.dungeon.model.runtime.usecase.ApplyTravelDungeonMovementUseCase;
import src.domain.dungeon.model.runtime.usecase.MoveDungeonTravelActionUseCase;

final class DungeonTravelNavigator {

    private final ApplyTravelDungeonMovementUseCase movementUseCase;

    DungeonTravelNavigator(
            TravelPartyStateRepository partyStateRepository,
            TravelPartyPositionRepository partyPositionRepository,
            DungeonTravelSurfaceLoader surfaceLoader,
            MoveDungeonTravelActionUseCase moveActionUseCase
    ) {
        movementUseCase = new ApplyTravelDungeonMovementUseCase(
                Objects.requireNonNull(partyStateRepository, "partyStateRepository"),
                Objects.requireNonNull(partyPositionRepository, "partyPositionRepository"),
                Objects.requireNonNull(surfaceLoader, "surfaceLoader").legacySurfaceUseCase(),
                Objects.requireNonNull(moveActionUseCase, "moveActionUseCase"));
    }

    ApplyTravelDungeonMovementUseCase legacyMovementUseCase() {
        return movementUseCase;
    }
}
