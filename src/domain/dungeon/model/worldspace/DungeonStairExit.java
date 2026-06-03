package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.component.StairExit;
import src.domain.dungeon.model.core.geometry.Cell;

public record DungeonStairExit(
        long exitId,
        DungeonCell position,
        String label
) {

    public DungeonStairExit {
        StairExit component = new StairExit(
                exitId,
                position == null ? new Cell(0, 0, 0) : position.geometry(),
                label);
        exitId = component.exitId();
        position = DungeonCell.fromGeometry(component.position());
        label = component.label();
    }
}
