package features.dungeon.domain.core.geometry;

public record Cell(int q, int r, int level) {

    public static Cell empty() {
        return new Cell(0, 0, 0);
    }

    public Cell translate(int deltaQ, int deltaR) {
        return new Cell(q + deltaQ, r + deltaR, level);
    }
}
