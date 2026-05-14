package src.data.travel.repository;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.data.travel.mapper.TravelDungeonSessionSurfaceMapper;
import src.domain.dungeon.DungeonTravelApplicationService;
import src.domain.dungeon.published.DungeonTravelCommand;
import src.domain.dungeon.published.DungeonTravelMoveResult;
import src.domain.dungeon.published.DungeonTravelModel;
import src.domain.dungeon.published.DungeonTravelResponse;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;
import src.domain.travel.application.ApplyTravelDungeonSessionUseCase;

public final class ApplicationTravelDungeonSessionRepository
        implements ApplyTravelDungeonSessionUseCase.SessionRepository {

    private final ApplicationTravelPartyStateRepository partyStateRepository;
    private final DungeonTravelApplicationService dungeonTravelApplicationService;
    private final DungeonTravelModel dungeonTravelModel;

    public ApplicationTravelDungeonSessionRepository(
            ApplicationTravelPartyStateRepository partyStateRepository,
            DungeonTravelApplicationService dungeonTravelApplicationService,
            DungeonTravelModel dungeonTravelModel
    ) {
        this.partyStateRepository = Objects.requireNonNull(partyStateRepository, "partyStateRepository");
        this.dungeonTravelApplicationService =
                Objects.requireNonNull(dungeonTravelApplicationService, "dungeonTravelApplicationService");
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
        dungeonTravelApplicationService.travel(new DungeonTravelCommand.LoadSurface(
                TravelDungeonSessionSurfaceMapper.toDungeonPosition(position)));
        return TravelDungeonSessionSurfaceMapper.toInternalSurface(surfaceResponse(dungeonTravelModel.current()));
    }

    @Override
    public ApplyTravelDungeonSessionUseCase.MoveResultData moveDungeonAction(
            ApplyTravelDungeonSessionUseCase.@Nullable PositionData position,
            String actionId
    ) {
        dungeonTravelApplicationService.travel(new DungeonTravelCommand.MoveAction(
                TravelDungeonSessionSurfaceMapper.toDungeonPosition(position),
                actionId));
        return TravelDungeonSessionSurfaceMapper.toInternalMoveResult(moveResponse(dungeonTravelModel.current()));
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
