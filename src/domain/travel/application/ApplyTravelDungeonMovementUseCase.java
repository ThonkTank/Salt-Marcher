package src.domain.travel.application;

import org.jspecify.annotations.Nullable;

final class ApplyTravelDungeonMovementUseCase {

    ApplyTravelDungeonSessionUseCase.SurfaceData move(
            ApplyTravelDungeonSessionUseCase.RuntimeAccess runtimeAccess,
            ApplyTravelDungeonSessionUseCase.@Nullable PositionData requestedTravelPosition,
            String actionId
    ) {
        ApplyTravelDungeonSessionUseCase.ActiveTravelStateData activeTravel = runtimeAccess.loadActiveTravelState();
        ApplyTravelDungeonSessionUseCase.PositionData effectivePosition = requestedTravelPosition != null
                ? requestedTravelPosition
                : ApplyTravelDungeonSessionUseCase.toTravelPosition(activeTravel.partyLocation());
        ApplyTravelDungeonSessionUseCase.MoveResultData result = runtimeAccess.moveDungeonAction(
                effectivePosition,
                actionId);
        if (result.status().isExternalTarget() && result.externalTarget() != null) {
            boolean saved = runtimeAccess.saveOverworldPosition(
                    result.externalTarget(),
                    activeTravel.travelCharacterIds());
            return saved
                    ? ApplyTravelDungeonSessionUseCase.outsideDungeonSurface(result.externalTarget().tileId())
                    : result.surface();
        }
        if (result.status().isSuccess()) {
            runtimeAccess.saveDungeonPosition(result.surface().position(), activeTravel.travelCharacterIds());
        }
        return result.surface();
    }
}
