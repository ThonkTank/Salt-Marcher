package src.domain.dungeon.model.core.component;

import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;

public record StairExit(long exitId, Cell position, String label) {

    public StairExit {
        exitId = Math.max(0L, exitId);
        Objects.requireNonNull(position);
        label = label == null || label.isBlank() ? defaultLabel(position) : label.trim();
    }

    private static String defaultLabel(Cell position) {
        return "Ausgang z=" + position.level() + " (" + position.q() + "," + position.r() + ")";
    }
}
