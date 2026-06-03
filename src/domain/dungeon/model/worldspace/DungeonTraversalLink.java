package src.domain.dungeon.model.worldspace;

import java.util.Set;
import org.jspecify.annotations.Nullable;

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

    public boolean touches(Set<DungeonCell> cells) {
        return endpointFrom(cells) != null;
    }

    public @Nullable DungeonTraversalEndpoint endpointFrom(Set<DungeonCell> cells) {
        if (cells == null || cells.isEmpty()) {
            return null;
        }
        boolean first = cells.contains(firstEndpoint.tile());
        boolean second = cells.contains(secondEndpoint.tile());
        return first == second ? null : first ? firstEndpoint : secondEndpoint;
    }

    public @Nullable DungeonEdgeDirection directionFrom(DungeonCell sourceTile) {
        DungeonCell targetTile = targetTileFrom(sourceTile);
        if (sourceTile == null || targetTile == null || sourceTile.level() != targetTile.level()) {
            return null;
        }
        return directionFor(targetTile.q() - sourceTile.q(), targetTile.r() - sourceTile.r());
    }

    private @Nullable DungeonCell targetTileFrom(DungeonCell tile) {
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

    private static @Nullable DungeonEdgeDirection directionFor(int deltaQ, int deltaR) {
        for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
            if (direction.deltaQ() == deltaQ && direction.deltaR() == deltaR) {
                return direction;
            }
        }
        return null;
    }

    private static DungeonTraversalEndpoint defaultEndpoint() {
        return new DungeonTraversalEndpoint(new DungeonCell(0, 0, 0), 0L, "");
    }
}
