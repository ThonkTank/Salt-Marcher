package src.domain.dungeon.application;

import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonTravelMoveFacts;
import src.domain.dungeon.map.value.DungeonTravelPositionFacts;
import src.domain.dungeon.map.value.DungeonTravelSurfaceFacts;
import src.domain.dungeon.published.DungeonTravelCommand;
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

    public DungeonTravelResponse handle(@Nullable DungeonTravelCommand command) {
        DungeonTravelCommand effectiveCommand = command == null
                ? new DungeonTravelCommand.LoadSurface(null)
                : command;
        if (effectiveCommand instanceof DungeonTravelCommand.LoadSurface loadSurface) {
            return new DungeonTravelResponse.Surface(DungeonTravelProjector.surface(
                    loadTravelSurfacePath.apply(DungeonTravelProjector.domainPosition(loadSurface.position()))));
        }
        DungeonTravelCommand.MoveAction moveAction = (DungeonTravelCommand.MoveAction) effectiveCommand;
        return new DungeonTravelResponse.Move(DungeonTravelProjector.move(moveTravelActionPath.apply(
                new MoveDungeonTravelActionUseCase.Input(
                        DungeonTravelProjector.domainPosition(moveAction.position()),
                        moveAction.actionId()))));
    }
}
