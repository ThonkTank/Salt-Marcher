package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.runtime.repository.TravelPartyPositionRepository;
import src.domain.dungeon.model.runtime.repository.TravelPartyStateRepository;
import src.domain.dungeon.model.runtime.usecase.LoadDungeonTravelSurfaceUseCase;
import src.domain.dungeon.model.runtime.usecase.LoadTravelDungeonSessionSurfaceUseCase;

final class DungeonTravelSurfaceLoader {

    private final LoadDungeonTravelSurfaceUseCase loadSurfaceUseCase;
    private final LoadTravelDungeonSessionSurfaceUseCase loadSessionSurfaceUseCase;

    DungeonTravelSurfaceLoader(
            TravelPartyStateRepository partyStateRepository,
            TravelPartyPositionRepository partyPositionRepository,
            LoadDungeonTravelSurfaceUseCase loadSurfaceUseCase
    ) {
        this.loadSurfaceUseCase = Objects.requireNonNull(loadSurfaceUseCase, "loadSurfaceUseCase");
        loadSessionSurfaceUseCase = new LoadTravelDungeonSessionSurfaceUseCase(
                Objects.requireNonNull(partyStateRepository, "partyStateRepository"),
                Objects.requireNonNull(partyPositionRepository, "partyPositionRepository"),
                this.loadSurfaceUseCase);
    }

    LoadDungeonTravelSurfaceUseCase legacySurfaceUseCase() {
        return loadSurfaceUseCase;
    }

    LoadTravelDungeonSessionSurfaceUseCase legacySessionUseCase() {
        return loadSessionSurfaceUseCase;
    }
}
