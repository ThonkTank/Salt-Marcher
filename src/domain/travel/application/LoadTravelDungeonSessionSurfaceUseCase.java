package src.domain.travel.application;

import org.jspecify.annotations.Nullable;

final class LoadTravelDungeonSessionSurfaceUseCase {

    ApplyTravelDungeonSessionUseCase.SurfaceData load(
            ApplyTravelDungeonSessionUseCase.SessionRepository runtimeAccess,
            ApplyTravelDungeonSessionUseCase.@Nullable PositionData requestedTravelPosition
    ) {
        ApplyTravelDungeonSessionUseCase.ActiveTravelStateData activeTravel = runtimeAccess.loadActiveTravelState();
        if (activeTravel.partyLocation() != null && activeTravel.partyLocation().outsideDungeon()) {
            return ApplyTravelDungeonSessionUseCase.outsideDungeonSurface(activeTravel.partyLocation().overworldTileId());
        }
        ApplyTravelDungeonSessionUseCase.PositionData effectivePosition = requestedTravelPosition != null
                ? requestedTravelPosition
                : ApplyTravelDungeonSessionUseCase.toTravelPosition(activeTravel.partyLocation());
        ApplyTravelDungeonSessionUseCase.SurfaceData surface = runtimeAccess.loadDungeonSurface(effectivePosition);
        if (requestedTravelPosition == null
                && activeTravel.partyLocation() == null
                && !activeTravel.travelCharacterIds().isEmpty()) {
            runtimeAccess.saveDungeonPosition(surface.position(), activeTravel.travelCharacterIds());
        }
        return surface;
    }
}
