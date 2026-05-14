package src.domain.dungeon.model.travel.model.session.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonActiveState;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonActiveState.ActiveTravelStateData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionMovement.MoveResultData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.travel.model.session.repository.TravelDungeonSessionRepository;

public final class ApplyTravelDungeonMovementUseCase {

    public SurfaceData move(
            TravelDungeonSessionRepository runtimeAccess,
            @Nullable PositionData requestedTravelPosition,
            String actionId
    ) {
        ActiveTravelStateData activeTravel = runtimeAccess.loadActiveTravelState();
        PositionData effectivePosition = requestedTravelPosition != null
                ? requestedTravelPosition
                : TravelDungeonActiveState.toTravelPosition(activeTravel.partyLocation());
        MoveResultData result = runtimeAccess.moveDungeonAction(effectivePosition, actionId);
        if (result.status().isExternalTarget() && result.externalTarget() != null) {
            boolean saved = runtimeAccess.saveOverworldPosition(
                    result.externalTarget(),
                    activeTravel.travelCharacterIds());
            return saved
                    ? TravelDungeonSessionSurface.outsideDungeonSurface(result.externalTarget().tileId())
                    : result.surface();
        }
        if (result.status().isSuccess()) {
            runtimeAccess.saveDungeonPosition(result.surface().position(), activeTravel.travelCharacterIds());
        }
        return result.surface();
    }
}
