package src.domain.dungeon.model.worldspace.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonActiveState;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonActiveState.ActiveTravelStateData;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionMovement;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionMovement.MoveResultData;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.worldspace.repository.TravelDungeonSessionRepository;

public final class ApplyTravelDungeonMovementUseCase {

    public SurfaceData move(
            TravelDungeonSessionRepository runtimeAccess,
            @Nullable PositionData requestedTravelPosition,
            String actionId
    ) {
        ActiveTravelStateData activeTravel = runtimeAccess.loadActiveTravelState();
        PositionData effectivePosition =
                TravelDungeonActiveState.effectiveTravelPosition(requestedTravelPosition, activeTravel.partyLocation());
        MoveResultData result = TravelDungeonSessionMovement.safe(
                runtimeAccess.moveDungeonAction(effectivePosition, actionId));
        return applyResult(runtimeAccess, activeTravel, result);
    }

    private static SurfaceData applyResult(
            TravelDungeonSessionRepository runtimeAccess,
            ActiveTravelStateData activeTravel,
            MoveResultData result
    ) {
        if (result.status().isExternalTarget() && result.externalTarget() != null) {
            return applyExternalTarget(runtimeAccess, activeTravel, result);
        }
        if (result.status().isSuccess()) {
            runtimeAccess.saveDungeonPosition(result.surface().position(), activeTravel.travelCharacterIds());
        }
        return result.surface();
    }

    private static SurfaceData applyExternalTarget(
            TravelDungeonSessionRepository runtimeAccess,
            ActiveTravelStateData activeTravel,
            MoveResultData result
    ) {
        boolean saved = runtimeAccess.saveOverworldPosition(
                result.externalTarget(),
                activeTravel.travelCharacterIds());
        return saved
                ? TravelDungeonSessionSurface.outsideDungeonSurface(result.externalTarget().tileId())
                : result.surface();
    }
}
