package src.domain.travel.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonApplicationService;
import src.domain.dungeon.published.DungeonTravelMoveResult;
import src.domain.dungeon.published.DungeonTravelResponse;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;
import src.domain.dungeon.published.DungeonTravelCommand;

public final class TravelDungeonBoundaryTranslator {

    private TravelDungeonBoundaryTranslator() {
    }

    public static ApplyTravelDungeonSessionUseCase.SurfaceData loadDungeonSurface(
            DungeonApplicationService dungeonApplicationService,
            ApplyTravelDungeonSessionUseCase.@Nullable PositionData position
    ) {
        return TravelDungeonSurfaceProjector.toInternalSurface(surfaceResponse(dungeonApplicationService.travel(
                new DungeonTravelCommand.LoadSurface(TravelDungeonSurfaceProjector.toDungeonPosition(position)))));
    }

    public static ApplyTravelDungeonSessionUseCase.MoveResultData moveDungeonAction(
            DungeonApplicationService dungeonApplicationService,
            ApplyTravelDungeonSessionUseCase.@Nullable PositionData position,
            String actionId
    ) {
        return TravelDungeonSurfaceProjector.toInternalMoveResult(moveResponse(dungeonApplicationService.travel(
                new DungeonTravelCommand.MoveAction(
                        TravelDungeonSurfaceProjector.toDungeonPosition(position),
                        actionId))));
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
