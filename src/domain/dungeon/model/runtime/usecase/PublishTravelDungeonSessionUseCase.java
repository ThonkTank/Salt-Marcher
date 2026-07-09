package src.domain.dungeon.model.runtime.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.runtime.repository.TravelDungeonSessionPublishedStateRepository;
import src.domain.dungeon.model.runtime.travel.projection.TravelActionFacts.SelectedAction;
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

        public static Command fromBoundary(
                int actionCode,
                int selectedActionRowIndex,
                long mapId,
                int projectionLevel,
                String overlayModeKey,
                int overlayLevelRange,
                double overlayOpacity,
                List<Integer> overlaySelectedLevels
        ) {
            return switch (ActionKind.fromCode(actionCode)) {
                case REFRESH -> refresh();
                case ACTION -> travelAction(selectedActionRowIndex);
                case SELECT_MAP -> selectMap(Long.toString(mapId));
                case SET_PROJECTION_LEVEL -> setProjectionLevel(projectionLevel);
                case SHIFT_PROJECTION_LEVEL -> shiftProjectionLevel(projectionLevel);
                case SET_OVERLAY -> setOverlay(
                        overlayModeKey,
                        overlayLevelRange,
                        overlayOpacity,
                        overlaySelectedLevels);
            };
        }

        public static Command refresh() {
            return new Command(TravelDungeonSessionCommand.refresh());
        }

        public static Command travelAction(int selectedActionRowIndex) {
            return new Command(TravelDungeonSessionCommand.travelAction(SelectedAction.atRow(selectedActionRowIndex)));
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

        private enum ActionKind {
            REFRESH(0),
            ACTION(1),
            SELECT_MAP(2),
            SET_PROJECTION_LEVEL(3),
            SHIFT_PROJECTION_LEVEL(4),
            SET_OVERLAY(5);

            private final int code;

            ActionKind(int code) {
                this.code = code;
            }

            private static ActionKind fromCode(int actionCode) {
                for (ActionKind kind : values()) {
                    if (kind.code == actionCode) {
                        return kind;
                    }
                }
                return REFRESH;
            }
        }
    }
}
