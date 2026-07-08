package src.domain.dungeon.model.runtime.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.runtime.repository.TravelDungeonSessionPublishedStateRepository;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionCommand;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSnapshot.SnapshotData;

public final class PublishTravelDungeonSessionUseCase {

    private final ApplyTravelDungeonSessionUseCase applyTravelDungeonSessionUseCase;
    private final TravelDungeonSessionPublishedStateRepository publishedStateRepository;

    public PublishTravelDungeonSessionUseCase(
            ApplyTravelDungeonSessionUseCase applyTravelDungeonSessionUseCase,
            TravelDungeonSessionPublishedStateRepository publishedStateRepository
    ) {
        this.applyTravelDungeonSessionUseCase =
                Objects.requireNonNull(applyTravelDungeonSessionUseCase, "applyTravelDungeonSessionUseCase");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(Command command) {
        SnapshotData snapshot = applyTravelDungeonSessionUseCase.applyCommand(
                Objects.requireNonNull(command, "command").travelCommand);
        publishedStateRepository.publishCurrentSession(snapshot);
    }

    public static final class Command {

        private final TravelDungeonSessionCommand travelCommand;

        private Command(TravelDungeonSessionCommand travelCommand) {
            this.travelCommand = Objects.requireNonNull(travelCommand, "travelCommand");
        }

        public static Command refresh() {
            return new Command(TravelDungeonSessionCommand.refresh());
        }

        public static Command travelAction(String actionId) {
            return new Command(TravelDungeonSessionCommand.travelAction(actionId));
        }

        public static Command selectMap(String mapIdValue) {
            return new Command(TravelDungeonSessionCommand.selectMap(mapIdValue));
        }

        public static Command setProjectionLevel(int projectionLevel) {
            return new Command(TravelDungeonSessionCommand.setProjectionLevel(projectionLevel));
        }

        public static Command shiftProjectionLevel(int projectionLevelShift) {
            return new Command(TravelDungeonSessionCommand.shiftProjectionLevel(projectionLevelShift));
        }

        public static Command setOverlay(
                String overlayModeKey,
                int overlayLevelRange,
                double overlayOpacity,
                List<Integer> overlaySelectedLevels
        ) {
            return new Command(TravelDungeonSessionCommand.setOverlay(
                    overlayModeKey,
                    overlayLevelRange,
                    overlayOpacity,
                    overlaySelectedLevels));
        }
    }
}
