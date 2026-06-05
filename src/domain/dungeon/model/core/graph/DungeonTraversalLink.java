package src.domain.dungeon.model.core.graph;

import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;

public record DungeonTraversalLink(
        String key,
        DungeonTraversalSource source,
        DungeonTraversalEndpoint firstEndpoint,
        DungeonTraversalEndpoint secondEndpoint
) {

    public DungeonTraversalLink {
        key = key == null || key.isBlank() ? "traversal:0:0,0,0:0,0,0" : key.trim();
        source = source == null ? new DungeonTraversalSource(DungeonTraversalSourceKind.DOOR, 0L, "Tür") : source;
        firstEndpoint = firstEndpoint == null ? defaultEndpoint() : firstEndpoint;
        secondEndpoint = secondEndpoint == null ? defaultEndpoint() : secondEndpoint;
    }

    public boolean touches(Set<Cell> cells) {
        return endpointFrom(cells) != null;
    }

    public @Nullable DungeonTraversalEndpoint endpointFrom(Set<Cell> cells) {
        if (cells == null || cells.isEmpty()) {
            return null;
        }
        boolean first = cells.contains(firstEndpoint.tile());
        boolean second = cells.contains(secondEndpoint.tile());
        return first == second ? null : first ? firstEndpoint : secondEndpoint;
    }

    public @Nullable Direction directionFrom(Cell sourceTile) {
        Cell targetTile = targetTileFrom(sourceTile);
        if (sourceTile == null || targetTile == null || sourceTile.level() != targetTile.level()) {
            return null;
        }
        return directionFor(targetTile.q() - sourceTile.q(), targetTile.r() - sourceTile.r());
    }

    private @Nullable Cell targetTileFrom(Cell tile) {
        if (tile == null) {
            return null;
        }
        if (tile.equals(firstEndpoint.tile())) {
            return secondEndpoint.tile();
        }
        if (tile.equals(secondEndpoint.tile())) {
            return firstEndpoint.tile();
        }
        return null;
    }

    private static @Nullable Direction directionFor(int deltaQ, int deltaR) {
        for (Direction direction : Direction.values()) {
            if (direction.deltaQ() == deltaQ && direction.deltaR() == deltaR) {
                return direction;
            }
        }
        return null;
    }

    private static DungeonTraversalEndpoint defaultEndpoint() {
        return new DungeonTraversalEndpoint(new Cell(0, 0, 0), 0L, "");
    }
}
