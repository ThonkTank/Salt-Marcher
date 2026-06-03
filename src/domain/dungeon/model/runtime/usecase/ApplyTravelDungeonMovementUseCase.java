package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.repository.TravelPartyStateRepository;
import src.domain.dungeon.model.runtime.repository.TravelPartyPositionRepository;
import src.domain.dungeon.model.runtime.travel.projection.TravelDungeonSessionProjectionMapper;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState.ActiveTravelStateData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionMovement;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionMovement.MoveResultData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface.SurfaceData;

public final class ApplyTravelDungeonMovementUseCase {

    private final TravelPartyStateRepository partyStateRepository;
    private final TravelPartyPositionRepository partyPositionRepository;
    private final LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase;
    private final MoveDungeonTravelActionUseCase moveDungeonTravelActionUseCase;

    public ApplyTravelDungeonMovementUseCase(
            TravelPartyStateRepository partyStateRepository,
            TravelPartyPositionRepository partyPositionRepository,
            LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase,
            MoveDungeonTravelActionUseCase moveDungeonTravelActionUseCase
    ) {
        this.partyStateRepository = Objects.requireNonNull(partyStateRepository, "partyStateRepository");
        this.partyPositionRepository = Objects.requireNonNull(partyPositionRepository, "partyPositionRepository");
        this.loadDungeonTravelSurfaceUseCase =
                Objects.requireNonNull(loadDungeonTravelSurfaceUseCase, "loadDungeonTravelSurfaceUseCase");
        this.moveDungeonTravelActionUseCase =
                Objects.requireNonNull(moveDungeonTravelActionUseCase, "moveDungeonTravelActionUseCase");
    }

    public SurfaceData move(
            @Nullable PositionData requestedTravelPosition,
            @Nullable SurfaceData currentSurface,
            String actionId
    ) {
        ActiveTravelStateData activeTravel = partyStateRepository.loadActiveTravelState();
        @Nullable PositionData effectivePosition =
                TravelDungeonActiveState.effectiveTravelPosition(requestedTravelPosition, activeTravel.partyLocation());
        if (effectivePosition == null) {
            return currentSurface == null
                    ? TravelDungeonSessionSurface.outsideDungeonSurface(0L)
                    : currentSurface;
        }
        MoveResultData result = TravelDungeonSessionMovement.safe(
                moveDungeonTravelActionUseCase.execute(new MoveDungeonTravelActionUseCase.Input(
                        TravelDungeonSessionProjectionMapper.toRuntimePositionFacts(effectivePosition),
                        actionId)));
        return applyResult(
                effectivePosition,
                activeTravel,
                result);
    }

    private SurfaceData applyResult(
            @Nullable PositionData effectivePosition,
            ActiveTravelStateData activeTravel,
            MoveResultData result
    ) {
        if (result.status().isExternalTarget() && result.externalTarget() != null) {
            return applyExternalTarget(activeTravel, result, effectivePosition);
        }
        if (result.status().isSuccess()) {
            boolean saved = partyPositionRepository.saveDungeonPosition(
                    result.surface().position(),
                    activeTravel.travelCharacterIds());
            return saved ? result.surface() : currentSurface(effectivePosition);
        }
        return result.surface();
    }

    private SurfaceData currentSurface(@Nullable PositionData effectivePosition) {
        return TravelDungeonSessionProjectionMapper.toRuntimeSurface(
                loadDungeonTravelSurfaceUseCase.execute(new LoadDungeonTravelSurfaceUseCase.Input(
                        TravelDungeonSessionProjectionMapper.toRuntimePositionFacts(effectivePosition))));
    }

    private SurfaceData applyExternalTarget(
            ActiveTravelStateData activeTravel,
            MoveResultData result,
            @Nullable PositionData effectivePosition
    ) {
        boolean saved = partyPositionRepository.saveOverworldPosition(
                result.externalTarget(),
                activeTravel.travelCharacterIds());
        return saved
                ? TravelDungeonSessionSurface.outsideDungeonSurface(result.externalTarget().tileId())
                : currentSurface(effectivePosition);
    }
}
