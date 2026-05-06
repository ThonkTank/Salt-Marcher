package src.domain.dungeon.application;

import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonTravelMoveFacts;
import src.domain.dungeon.map.value.DungeonTravelPositionFacts;
import src.domain.dungeon.map.value.DungeonTravelSurfaceFacts;
import src.domain.dungeon.published.DungeonTravelRequest;
import src.domain.dungeon.published.DungeonTravelResponse;

public final class DungeonTravelRuntimeAdapter {

    private final Function<DungeonTravelPositionFacts, DungeonTravelSurfaceFacts> loadTravelSurfacePath;
    private final Function<MoveDungeonTravelActionUseCase.Input, DungeonTravelMoveFacts> moveTravelActionPath;

    public DungeonTravelRuntimeAdapter(
            LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase,
            MoveDungeonTravelActionUseCase moveDungeonTravelActionUseCase
    ) {
        this.loadTravelSurfacePath = position -> loadDungeonTravelSurfaceUseCase.execute(
                new LoadDungeonTravelSurfaceUseCase.Input(position));
        this.moveTravelActionPath = moveDungeonTravelActionUseCase::execute;
    }

    public DungeonTravelResponse handle(@Nullable DungeonTravelRequest request) {
        DungeonTravelRequest effectiveRequest = request == null
                ? new DungeonTravelRequest.LoadSurface(null)
                : request;
        if (effectiveRequest instanceof DungeonTravelRequest.LoadSurface loadSurface) {
            return new DungeonTravelResponse.Surface(DungeonTravelProjector.surface(
                    loadTravelSurfacePath.apply(DungeonTravelProjector.domainPosition(loadSurface.position()))));
        }
        DungeonTravelRequest.MoveAction moveAction = (DungeonTravelRequest.MoveAction) effectiveRequest;
        return new DungeonTravelResponse.Move(DungeonTravelProjector.move(moveTravelActionPath.apply(
                new MoveDungeonTravelActionUseCase.Input(
                        DungeonTravelProjector.domainPosition(moveAction.position()),
                        moveAction.actionId()))));
    }
}
