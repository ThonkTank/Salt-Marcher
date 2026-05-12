package src.domain.dungeon.model.map.model;

import java.util.List;

/**
 * Identity-bearing authored dungeon area.
 */
public final class DungeonState {

    private final long id;
    private final DungeonAreaType kind;
    private final String label;
    private final List<DungeonCell> cells;

    public DungeonState(long id, DungeonAreaType kind, String label, List<DungeonCell> cells) {
        this.id = id;
        this.kind = kind == null ? DungeonAreaType.ROOM : kind;
        this.label = label == null || label.isBlank() ? "Area" : label;
        this.cells = cells == null ? List.of() : List.copyOf(cells);
    }

    public long id() {
        return id;
    }

    public DungeonAreaType kind() {
        return kind;
    }

    public String label() {
        return label;
    }

    public List<DungeonCell> cells() {
        return cells;
    }
}
