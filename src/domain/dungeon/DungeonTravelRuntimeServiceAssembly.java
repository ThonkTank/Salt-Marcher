package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.travel.repository.TravelDungeonSessionRepository;
import src.domain.dungeon.model.travel.usecase.ApplyTravelDungeonSessionUseCase;
import src.domain.dungeon.published.TravelDungeonModel;

final class DungeonTravelRuntimeServiceAssembly {

    private final ApplyTravelDungeonSessionUseCase applyUseCase;
    private final TravelDungeonModel travelModel;

    DungeonTravelRuntimeServiceAssembly(TravelDungeonSessionRepository repository) {
        DungeonTravelRuntimePublicationServiceAssembly publication =
                new DungeonTravelRuntimePublicationServiceAssembly();
        applyUseCase = new ApplyTravelDungeonSessionUseCase(
                Objects.requireNonNull(repository, "repository"),
                publication::publishSnapshot);
        publication.connectSnapshotSource(applyUseCase::snapshot);
        travelModel = publication.travelModel();
    }

    DungeonTravelRuntimeApplicationService applicationService() {
        return new DungeonTravelRuntimeApplicationService(applyUseCase);
    }

    TravelDungeonModel travelModel() {
        return travelModel;
    }
}
