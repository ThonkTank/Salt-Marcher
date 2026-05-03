package src.domain.travel.published;

public record TravelDungeonBoundary(
        String kind,
        long id,
        String label,
        TravelDungeonEdge edge
) {

    public TravelDungeonBoundary {
        kind = kind == null || kind.isBlank() ? "boundary" : kind.trim();
        id = Math.max(1L, id);
        label = label == null || label.isBlank() ? kind : label.trim();
        edge = edge == null ? new TravelDungeonEdge(new TravelDungeonCell(0, 0, 0), new TravelDungeonCell(0, 0, 0)) : edge;
    }
}
