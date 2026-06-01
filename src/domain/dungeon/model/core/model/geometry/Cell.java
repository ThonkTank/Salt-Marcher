package src.domain.dungeon.model.core.model.geometry;

public record Cell(int q, int r, int level) {

    public Cell translate(int deltaQ, int deltaR) {
        return new Cell(q + deltaQ, r + deltaR, level);
    }
}
