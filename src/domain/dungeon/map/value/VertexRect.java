package src.domain.dungeon.map.value;

public record VertexRect(
        int floor,
        int minQ,
        int minR,
        int maxQ,
        int maxR
) {

    public VertexRect {
        if (maxQ < minQ || maxR < minR) {
            throw new IllegalArgumentException("VertexRect max bounds must be >= min bounds.");
        }
    }
}
