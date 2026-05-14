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
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonActiveState.ActiveTravelStateData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionMovement.MoveResultData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionMovement.OverworldTargetData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.travel.model.session.repository.TravelDungeonSessionRepository;

public final class ApplicationTravelDungeonSessionRepository
        implements TravelDungeonSessionRepository {

    private final ApplicationTravelPartyStateRepository partyStateRepository;
    private final DungeonTravelApplicationService dungeonDungeonTravelRuntimeApplicationService;
    private final DungeonTravelModel dungeonTravelModel;

    public ApplicationTravelDungeonSessionRepository(
            ApplicationTravelPartyStateRepository partyStateRepository,
            DungeonTravelApplicationService dungeonDungeonTravelRuntimeApplicationService,
            DungeonTravelModel dungeonTravelModel
    ) {
        this.partyStateRepository = Objects.requireNonNull(partyStateRepository, "partyStateRepository");
        this.dungeonDungeonTravelRuntimeApplicationService =
                Objects.requireNonNull(dungeonDungeonTravelRuntimeApplicationService, "dungeonDungeonTravelRuntimeApplicationService");
        this.dungeonTravelModel = Objects.requireNonNull(dungeonTravelModel, "dungeonTravelModel");
    }

    @Override
    public ActiveTravelStateData loadActiveTravelState() {
        return partyStateRepository.loadActiveTravelState();
    }

    @Override
    public SurfaceData loadDungeonSurface(@Nullable PositionData position) {
        dungeonDungeonTravelRuntimeApplicationService.travel(new DungeonTravelCommand.LoadSurface(
                TravelDungeonSessionSurfaceMapper.toDungeonPosition(position)));
        return TravelDungeonSessionSurfaceMapper.toInternalSurface(surfaceResponse(dungeonTravelModel.current()));
    }

    @Override
    public MoveResultData moveDungeonAction(
            @Nullable PositionData position,
            String actionId
    ) {
        dungeonDungeonTravelRuntimeApplicationService.travel(new DungeonTravelCommand.MoveAction(
                TravelDungeonSessionSurfaceMapper.toDungeonPosition(position),
                actionId));
        return TravelDungeonSessionSurfaceMapper.toInternalMoveResult(moveResponse(dungeonTravelModel.current()));
    }

    @Override
    public void saveDungeonPosition(PositionData position, List<Long> characterIds) {
        partyStateRepository.saveDungeonPosition(position, characterIds);
    }

    @Override
    public boolean saveOverworldPosition(OverworldTargetData target, List<Long> characterIds) {
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
