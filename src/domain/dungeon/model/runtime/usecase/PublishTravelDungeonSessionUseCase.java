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

    public void execute(
            Action action,
            String actionId,
            int projectionLevel,
            String overlayModeKey,
            int overlayLevelRange,
            double overlayOpacity,
            List<Integer> overlaySelectedLevels
    ) {
        SnapshotData snapshot = applyTravelDungeonSessionUseCase.applyCommand(
                toRuntimeAction(action),
                actionId,
                projectionLevel,
                overlayModeKey,
                overlayLevelRange,
                overlayOpacity,
                overlaySelectedLevels);
        publishedStateRepository.publishCurrentSession(snapshot);
    }

    private static TravelDungeonSessionCommand.Action toRuntimeAction(Action action) {
        return switch (Objects.requireNonNull(action, "action")) {
            case REFRESH -> TravelDungeonSessionCommand.Action.REFRESH;
            case ACTION -> TravelDungeonSessionCommand.Action.ACTION;
            case SELECT_MAP -> TravelDungeonSessionCommand.Action.SELECT_MAP;
            case SET_PROJECTION_LEVEL -> TravelDungeonSessionCommand.Action.SET_PROJECTION_LEVEL;
            case SHIFT_PROJECTION_LEVEL -> TravelDungeonSessionCommand.Action.SHIFT_PROJECTION_LEVEL;
            case SET_OVERLAY -> TravelDungeonSessionCommand.Action.SET_OVERLAY;
        };
    }

    public enum Action {
        REFRESH,
        ACTION,
        SELECT_MAP,
        SET_PROJECTION_LEVEL,
        SHIFT_PROJECTION_LEVEL,
        SET_OVERLAY
    }
}
