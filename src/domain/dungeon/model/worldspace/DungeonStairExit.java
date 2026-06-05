package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.component.StairExit;
import src.domain.dungeon.model.core.geometry.Cell;

public record DungeonStairExit(
        long exitId,
        Cell position,
        String label
) {

    public DungeonStairExit {
        StairExit component = new StairExit(
                exitId,
                position == null ? new Cell(0, 0, 0) : position,
                label);
        exitId = component.exitId();
        position = component.position();
        label = component.label();
    }
}
