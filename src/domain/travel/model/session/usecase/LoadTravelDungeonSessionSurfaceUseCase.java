package src.domain.travel.model.session.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.travel.model.session.model.TravelDungeonActiveState;
import src.domain.travel.model.session.model.TravelDungeonActiveState.ActiveTravelStateData;
import src.domain.travel.model.session.model.TravelDungeonSessionSurface;
import src.domain.travel.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.travel.model.session.repository.TravelDungeonSessionRepository;

public final class LoadTravelDungeonSessionSurfaceUseCase {

    public SurfaceData load(
            TravelDungeonSessionRepository runtimeAccess,
            @Nullable PositionData requestedTravelPosition
    ) {
        ActiveTravelStateData activeTravel = runtimeAccess.loadActiveTravelState();
        if (activeTravel.partyLocation() != null && activeTravel.partyLocation().outsideDungeon()) {
            return TravelDungeonSessionSurface.outsideDungeonSurface(activeTravel.partyLocation().overworldTileId());
        }
        PositionData effectivePosition = requestedTravelPosition != null
                ? requestedTravelPosition
                : TravelDungeonActiveState.toTravelPosition(activeTravel.partyLocation());
        SurfaceData surface = runtimeAccess.loadDungeonSurface(effectivePosition);
        if (requestedTravelPosition == null
                && activeTravel.partyLocation() == null
                && !activeTravel.travelCharacterIds().isEmpty()) {
            runtimeAccess.saveDungeonPosition(surface.position(), activeTravel.travelCharacterIds());
        }
        return surface;
    }
}
