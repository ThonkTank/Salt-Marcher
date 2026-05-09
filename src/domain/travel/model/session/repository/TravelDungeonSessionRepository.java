package src.domain.travel.model.session.repository;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.DungeonTravelCommand;
import src.domain.dungeon.published.DungeonTravelMoveResult;
import src.domain.dungeon.published.DungeonTravelModel;
import src.domain.dungeon.published.DungeonTravelResponse;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;
import src.domain.travel.application.ApplyTravelDungeonSessionUseCase;
import src.domain.travel.model.session.helper.TravelDungeonSurfaceHelper;

public final class TravelDungeonSessionRepository implements ApplyTravelDungeonSessionUseCase.SessionRepository {

    private final TravelPartyStateRepository partyStateRepository;
    private final DungeonApplicationService dungeonApplicationService;
    private final DungeonTravelModel dungeonTravelModel;

    public TravelDungeonSessionRepository(
            TravelPartyStateRepository partyStateRepository,
            DungeonApplicationService dungeonApplicationService,
            DungeonTravelModel dungeonTravelModel
    ) {
        this.partyStateRepository = Objects.requireNonNull(partyStateRepository, "partyStateRepository");
        this.dungeonApplicationService = Objects.requireNonNull(dungeonApplicationService, "dungeonApplicationService");
        this.dungeonTravelModel = Objects.requireNonNull(dungeonTravelModel, "dungeonTravelModel");
    }

    @Override
    public ApplyTravelDungeonSessionUseCase.ActiveTravelStateData loadActiveTravelState() {
        return partyStateRepository.loadActiveTravelState();
    }

    @Override
    public ApplyTravelDungeonSessionUseCase.SurfaceData loadDungeonSurface(
            ApplyTravelDungeonSessionUseCase.@Nullable PositionData position
    ) {
        dungeonApplicationService.travel(new DungeonTravelCommand.LoadSurface(
                TravelDungeonSurfaceHelper.toDungeonPosition(position)));
        return TravelDungeonSurfaceHelper.toInternalSurface(surfaceResponse(dungeonTravelModel.current()));
    }

    @Override
    public ApplyTravelDungeonSessionUseCase.MoveResultData moveDungeonAction(
            ApplyTravelDungeonSessionUseCase.@Nullable PositionData position,
            String actionId
    ) {
        dungeonApplicationService.travel(new DungeonTravelCommand.MoveAction(
                TravelDungeonSurfaceHelper.toDungeonPosition(position),
                actionId));
        return TravelDungeonSurfaceHelper.toInternalMoveResult(moveResponse(dungeonTravelModel.current()));
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

    private static @Nullable DungeonTravelSurfaceSnapshot surfaceResponse(@Nullable DungeonTravelResponse response) {
        if (response instanceof DungeonTravelResponse.Surface surface) {
            return surface.surface();
        }
        return null;
    }

    private static @Nullable DungeonTravelMoveResult moveResponse(@Nullable DungeonTravelResponse response) {
        if (response instanceof DungeonTravelResponse.Move move) {
            return move.result();
        }
        return null;
    }
}
