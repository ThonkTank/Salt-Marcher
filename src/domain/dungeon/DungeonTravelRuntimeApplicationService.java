package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.travel.usecase.ApplyTravelDungeonSessionUseCase;
import src.domain.dungeon.published.ApplyTravelDungeonSessionCommand;

/**
 * Public backend facade for runtime travel composition.
 */
public final class DungeonTravelRuntimeApplicationService {

    private final ApplyTravelDungeonSessionUseCase applyTravelDungeonSessionUseCase;
    private final TravelRuntimePublication publication;

    public DungeonTravelRuntimeApplicationService(
            ApplyTravelDungeonSessionUseCase applyTravelDungeonSessionUseCase,
            TravelRuntimePublication publication
    ) {
        this.applyTravelDungeonSessionUseCase =
                Objects.requireNonNull(applyTravelDungeonSessionUseCase, "applyTravelDungeonSessionUseCase");
        this.publication = Objects.requireNonNull(publication, "publication");
    }

    public void applyDungeonTravelSession(ApplyTravelDungeonSessionCommand command) {
        Objects.requireNonNull(command, "command");
        applyTravelDungeonSessionUseCase.apply(
                command.action().name(),
                command.actionId(),
                command.projectionLevel(),
                command.overlaySettings().modeKey(),
                command.overlaySettings().levelRange(),
                command.overlaySettings().opacity(),
                command.overlaySettings().selectedLevels());
        publication.publishCurrentSession();
    }

    interface TravelRuntimePublication {
        void publishCurrentSession();
    }
}
