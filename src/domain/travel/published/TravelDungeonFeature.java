package src.domain.travel.published;

import java.util.List;

public record TravelDungeonFeature(
        Kind kind,
        long id,
        String label,
        List<TravelDungeonCell> cells,
        String description,
        String destinationLabel
) {

    public TravelDungeonFeature {
        kind = kind == null ? Kind.STAIR : kind;
        id = Math.max(1L, id);
        label = label == null || label.isBlank() ? kind.name() : label.trim();
        cells = cells == null ? List.of() : List.copyOf(cells);
        description = description == null ? "" : description.trim();
        destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
    }

    public enum Kind {
        STAIR,
        TRANSITION
    }
}
