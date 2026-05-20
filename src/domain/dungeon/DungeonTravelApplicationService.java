package src.domain.dungeon;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTravelPositionFacts;
import src.domain.dungeon.model.travel.usecase.ApplyDungeonTravelUseCase;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonTravelCommand;
import src.domain.dungeon.published.DungeonTravelPosition;

/**
 * Public authored-dungeon backend boundary for raw travel surface work.
 */
public final class DungeonTravelApplicationService {

    private final ApplyDungeonTravelUseCase applyDungeonTravelUseCase;

    public DungeonTravelApplicationService(ApplyDungeonTravelUseCase applyDungeonTravelUseCase) {
        this.applyDungeonTravelUseCase = Objects.requireNonNull(applyDungeonTravelUseCase, "applyDungeonTravelUseCase");
    }

    public void travel(DungeonTravelCommand command) {
        DungeonTravelCommand safeCommand = Objects.requireNonNull(command, "command");
        if (safeCommand instanceof DungeonTravelCommand.LoadSurface loadSurface) {
            applyDungeonTravelUseCase.loadSurface(domainTravelPosition(loadSurface.position()));
            return;
        }
        DungeonTravelCommand.MoveAction moveAction = (DungeonTravelCommand.MoveAction) safeCommand;
        applyDungeonTravelUseCase.move(domainTravelPosition(moveAction.position()), moveAction.actionId());
    }

    private static @Nullable DungeonTravelPositionFacts domainTravelPosition(@Nullable DungeonTravelPosition position) {
        if (position == null) {
            return null;
        }
        return new DungeonTravelPositionFacts(
                domainMapId(position.mapId()),
                src.domain.dungeon.model.map.model.DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                position.ownerId(),
                domainCell(position.tile()),
                src.domain.dungeon.model.map.model.DungeonTravelHeading.valueOf(position.heading().name()));
    }

    private static DungeonMapIdentity domainMapId(@Nullable DungeonMapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }

    private static DungeonCell domainCell(@Nullable DungeonCellRef cell) {
        return cell == null ? new DungeonCell(0, 0, 0) : new DungeonCell(cell.q(), cell.r(), cell.level());
    }
}
