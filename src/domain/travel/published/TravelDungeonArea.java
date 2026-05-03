package src.domain.travel.published;

import java.util.List;

public record TravelDungeonArea(
        Kind kind,
        long id,
        String label,
        List<TravelDungeonCell> cells
) {

    public TravelDungeonArea {
        kind = kind == null ? Kind.ROOM : kind;
        id = Math.max(1L, id);
        label = label == null || label.isBlank() ? kind.name() : label.trim();
        cells = cells == null ? List.of() : List.copyOf(cells);
    }

    public enum Kind {
        ROOM,
        CORRIDOR
    }
}
