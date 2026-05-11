package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.application.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.application.LoadDungeonMapUseCase;
import src.domain.dungeon.application.LoadDungeonTravelSurfaceUseCase;
import src.domain.dungeon.application.MoveDungeonTravelActionUseCase;
import src.domain.dungeon.application.PublishDungeonTravelResultUseCase;
import src.domain.dungeon.application.TranslateDungeonTravelInputUseCase;
import src.domain.dungeon.model.map.repository.DungeonMapRepository;
import src.domain.dungeon.model.map.repository.DungeonPublishedStateRepository;
import src.domain.dungeon.published.DungeonTravelCommand;
import src.domain.dungeon.published.DungeonTravelResponse;

/**
 * Public authored-dungeon backend boundary for raw travel surface work.
 */
public final class DungeonTravelApplicationService {

    private final DungeonPublishedStateRepository publishedStateRepository;
    private final LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase;
    private final MoveDungeonTravelActionUseCase moveDungeonTravelActionUseCase;
    private final PublishDungeonTravelResultUseCase publishResultUseCase = new PublishDungeonTravelResultUseCase();
    private final TranslateDungeonTravelInputUseCase translateInputUseCase = new TranslateDungeonTravelInputUseCase();

    public DungeonTravelApplicationService(
            DungeonMapRepository mapRepository,
            DungeonPublishedStateRepository publishedStateRepository
    ) {
        DungeonMapRepository repository = Objects.requireNonNull(mapRepository, "mapRepository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        LoadDungeonMapUseCase loadDungeonMapUseCase = new LoadDungeonMapUseCase(repository);
        this.loadDungeonTravelSurfaceUseCase = new LoadDungeonTravelSurfaceUseCase(loadDungeonMapUseCase, derive);
        this.moveDungeonTravelActionUseCase = new MoveDungeonTravelActionUseCase(
                loadDungeonMapUseCase,
                repository::findById,
                derive::execute);
    }

    public void travel(DungeonTravelCommand command) {
        DungeonTravelResponse response = travelResponse(Objects.requireNonNull(command, "command"));
        publishedStateRepository.publishTravel(response);
    }

    private DungeonTravelResponse travelResponse(DungeonTravelCommand command) {
        if (command instanceof DungeonTravelCommand.LoadSurface loadSurface) {
            return new DungeonTravelResponse.Surface(publishResultUseCase.travelSurface(
                    loadDungeonTravelSurfaceUseCase.execute(new LoadDungeonTravelSurfaceUseCase.Input(
                            translateInputUseCase.domainTravelPosition(loadSurface.position())))));
        }
        DungeonTravelCommand.MoveAction moveAction = (DungeonTravelCommand.MoveAction) command;
        return new DungeonTravelResponse.Move(publishResultUseCase.travelMoveResult(
                moveDungeonTravelActionUseCase.execute(new MoveDungeonTravelActionUseCase.Input(
                        translateInputUseCase.domainTravelPosition(moveAction.position()),
                        moveAction.actionId()))));
    }
}
