package src.domain.travel.application;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.travel.session.port.TravelPartyStateRepository;

public final class TravelDungeonRuntimeAccess implements ApplyTravelDungeonSessionUseCase.RuntimeAccess {

    private final TravelPartyStateRepository partyStateRepository;
    private final DungeonApplicationService dungeonApplicationService;

    public TravelDungeonRuntimeAccess(
            TravelPartyStateRepository partyStateRepository,
            DungeonApplicationService dungeonApplicationService
    ) {
        this.partyStateRepository = Objects.requireNonNull(partyStateRepository, "partyStateRepository");
        this.dungeonApplicationService = Objects.requireNonNull(dungeonApplicationService, "dungeonApplicationService");
    }

    @Override
    public ApplyTravelDungeonSessionUseCase.ActiveTravelStateData loadActiveTravelState() {
        return partyStateRepository.loadActiveTravelState();
    }

    @Override
    public ApplyTravelDungeonSessionUseCase.SurfaceData loadDungeonSurface(
            ApplyTravelDungeonSessionUseCase.@Nullable PositionData position
    ) {
        return TravelDungeonBoundaryTranslator.loadDungeonSurface(dungeonApplicationService, position);
    }

    @Override
    public ApplyTravelDungeonSessionUseCase.MoveResultData moveDungeonAction(
            ApplyTravelDungeonSessionUseCase.@Nullable PositionData position,
            String actionId
    ) {
        return TravelDungeonBoundaryTranslator.moveDungeonAction(dungeonApplicationService, position, actionId);
    }

    @Override
    public void saveDungeonPosition(ApplyTravelDungeonSessionUseCase.PositionData position, List<Long> characterIds) {
        partyStateRepository.saveDungeonPosition(position, characterIds);
    }

    @Override
    public boolean saveOverworldPosition(
            ApplyTravelDungeonSessionUseCase.OverworldTargetData target,
            List<Long> characterIds
    ) {
        return partyStateRepository.saveOverworldPosition(target, characterIds);
    }
}
