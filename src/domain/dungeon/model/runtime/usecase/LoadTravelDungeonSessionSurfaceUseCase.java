package src.domain.dungeon.model.runtime.usecase;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.repository.TravelPartyStateRepository;
import src.domain.dungeon.model.runtime.repository.TravelPartyPositionRepository;
import src.domain.dungeon.model.runtime.travel.projection.TravelDungeonSessionProjectionMapper;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState.ActiveTravelStateData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues.ContextKind;

public final class LoadTravelDungeonSessionSurfaceUseCase {

    private final TravelPartyStateRepository partyStateRepository;
    private final TravelPartyPositionRepository partyPositionRepository;
    private final LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase;

    public LoadTravelDungeonSessionSurfaceUseCase(
            TravelPartyStateRepository partyStateRepository,
            TravelPartyPositionRepository partyPositionRepository,
            LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase
    ) {
        this.partyStateRepository = Objects.requireNonNull(partyStateRepository, "partyStateRepository");
        this.partyPositionRepository = Objects.requireNonNull(partyPositionRepository, "partyPositionRepository");
        this.loadDungeonTravelSurfaceUseCase =
                Objects.requireNonNull(loadDungeonTravelSurfaceUseCase, "loadDungeonTravelSurfaceUseCase");
    }

    public SurfaceData loadOrInitialize(
            @Nullable PositionData requestedTravelPosition
    ) {
        ActiveTravelStateData activeTravel = partyStateRepository.loadActiveTravelState();
        if (activeTravel.partyLocation() != null && activeTravel.partyLocation().outsideDungeon()) {
            return TravelDungeonSessionSurface.outsideDungeonSurface(activeTravel.partyLocation().overworldTileId());
        }
        PositionData effectivePosition =
                TravelDungeonActiveState.effectiveTravelPosition(requestedTravelPosition, activeTravel.partyLocation());
        SurfaceData surface = TravelDungeonSessionProjectionMapper.toRuntimeSurface(
                loadDungeonTravelSurfaceUseCase.execute(new LoadDungeonTravelSurfaceUseCase.Input(
                        TravelDungeonSessionProjectionMapper.toRuntimePositionFacts(effectivePosition))));
        if (requestedTravelPosition == null
                && activeTravel.partyLocation() == null
                && !activeTravel.travelCharacterIds().isEmpty()) {
            boolean saved = partyPositionRepository.saveDungeonPosition(
                    surface.position(),
                    activeTravel.travelCharacterIds());
            return saved ? surface : failedInitialSaveSurface(surface);
        }
        return surface;
    }

    private static SurfaceData failedInitialSaveSurface(SurfaceData surface) {
        return new SurfaceData(
                ContextKind.DUNGEON,
                surface.mapName(),
                surface.revision(),
                surface.map(),
                surface.position(),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                "Position could not be saved.",
                surface.visualDescription(),
                List.of(),
                false);
    }
}
