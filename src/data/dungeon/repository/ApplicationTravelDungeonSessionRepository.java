package src.data.dungeon.repository;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.data.dungeon.mapper.TravelDungeonSessionSurfaceMapper;
import src.domain.dungeon.DungeonTravelApplicationService;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonActiveState.ActiveTravelStateData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionMovement.MoveResultData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.PositionData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionSurface.SurfaceData;
import src.domain.dungeon.model.travel.model.session.model.TravelDungeonSessionValues.OverworldTarget;
import src.domain.dungeon.model.travel.repository.TravelDungeonSessionRepository;
import src.domain.dungeon.published.DungeonTravelCommand;
import src.domain.dungeon.published.DungeonTravelModel;
import src.domain.dungeon.published.DungeonTravelMoveResult;
import src.domain.dungeon.published.DungeonTravelResponse;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartyTravelPositionsModel;

public final class ApplicationTravelDungeonSessionRepository implements TravelDungeonSessionRepository {

    private final ApplicationTravelPartyStateRepository partyStateRepository;
    private final DungeonTravelApplicationService dungeonTravelApplicationService;
    private final DungeonTravelModel dungeonTravelModel;

    public ApplicationTravelDungeonSessionRepository(
            PartyApplicationService party,
            ActivePartyModel activePartyModel,
            PartyTravelPositionsModel partyTravelPositionsModel,
            PartyMutationModel partyMutationModel,
            DungeonTravelApplicationService dungeonTravelApplicationService,
            DungeonTravelModel dungeonTravelModel
    ) {
        this.partyStateRepository = new ApplicationTravelPartyStateRepository(
                party,
                activePartyModel,
                partyTravelPositionsModel,
                partyMutationModel);
        this.dungeonTravelApplicationService =
                Objects.requireNonNull(dungeonTravelApplicationService, "dungeonTravelApplicationService");
        this.dungeonTravelModel = Objects.requireNonNull(dungeonTravelModel, "dungeonTravelModel");
    }

    @Override
    public ActiveTravelStateData loadActiveTravelState() {
        return partyStateRepository.loadActiveTravelState();
    }

    @Override
    public SurfaceData loadDungeonSurface(@Nullable PositionData position) {
        dungeonTravelApplicationService.loadSurface(new DungeonTravelCommand.LoadSurfaceCommand(
                TravelDungeonSessionSurfaceMapper.toDungeonPosition(position)));
        return TravelDungeonSessionSurfaceMapper.toInternalSurface(surfaceResponse(dungeonTravelModel.current()));
    }

    @Override
    public MoveResultData moveDungeonAction(
            @Nullable PositionData position,
            String actionId
    ) {
        dungeonTravelApplicationService.moveAction(new DungeonTravelCommand.MoveActionCommand(
                TravelDungeonSessionSurfaceMapper.toDungeonPosition(position),
                actionId));
        return TravelDungeonSessionSurfaceMapper.toInternalMoveResult(moveResponse(dungeonTravelModel.current()));
    }

    @Override
    public void saveDungeonPosition(PositionData position, List<Long> characterIds) {
        partyStateRepository.saveDungeonPosition(position, characterIds);
    }

    @Override
    public boolean saveOverworldPosition(OverworldTarget target, List<Long> characterIds) {
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
