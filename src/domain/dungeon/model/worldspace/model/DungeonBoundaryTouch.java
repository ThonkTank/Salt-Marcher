package src.domain.dungeon.model.worldspace.model;

import java.util.List;

public record DungeonBoundaryTouch(List<DungeonCell> insideCells) {

    public DungeonBoundaryTouch {
        insideCells = insideCells == null ? List.of() : List.copyOf(insideCells);
    }

    public boolean valid() {
        return insideCount() == 1 || insideCount() == 2;
    }

    public boolean touchesCluster() {
        return !insideCells.isEmpty();
    }

    public int insideCount() {
        return insideCells.size();
    }

    public boolean hasTwoInsideCells() {
        return insideCount() == 2;
    }
}
