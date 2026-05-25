package src.domain.dungeon.model.worldspace.usecase;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSnapshot.SnapshotData;
import src.domain.dungeon.model.worldspace.repository.TravelDungeonSessionPublishedStateRepository;

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
            String actionToken,
            String actionId,
            int projectionLevel,
            String overlayModeKey,
            int overlayLevelRange,
            double overlayOpacity,
            List<Integer> overlaySelectedLevels
    ) {
        SnapshotData snapshot = applyTravelDungeonSessionUseCase.applyCommand(
                actionToken,
                actionId,
                projectionLevel,
                overlayModeKey,
                overlayLevelRange,
                overlayOpacity,
                overlaySelectedLevels);
        publishedStateRepository.publishCurrentSession(snapshot);
    }
}
