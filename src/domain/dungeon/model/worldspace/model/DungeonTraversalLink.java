package src.domain.dungeon.model.worldspace.model;

import org.jspecify.annotations.Nullable;

import java.util.Locale;
import java.util.Set;

public record DungeonTraversalLink(
        String key,
        DungeonTraversalSource source,
        DungeonTraversalEndpoint firstEndpoint,
        DungeonTraversalEndpoint secondEndpoint
) {

    public DungeonTraversalLink {
        key = key == null || key.isBlank() ? fallbackKey(source, firstEndpoint, secondEndpoint) : key.trim();
        source = source == null
                ? new DungeonTraversalSource(DungeonTraversalSourceKind.DOOR, 0L, "Tür")
                : source;
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

    public @Nullable DungeonTraversalEndpoint oppositeOf(DungeonTraversalEndpoint endpoint) {
        if (endpoint == null) {
            return null;
        }
        if (endpoint.tile().equals(firstEndpoint.tile())) {
            return secondEndpoint;
        }
        if (endpoint.tile().equals(secondEndpoint.tile())) {
            return firstEndpoint;
        }
        return null;
    }

    public DungeonTravelHeading headingFrom(DungeonCell sourceTile, DungeonTravelHeading currentHeading) {
        DungeonTravelHeading fallback = currentHeading == null ? DungeonTravelHeading.defaultHeading() : currentHeading;
        DungeonEdgeDirection direction = directionFrom(sourceTile);
        return direction == null ? fallback : DungeonTravelHeading.valueOf(direction.name());
    }

    public @Nullable DungeonEdgeDirection directionFrom(DungeonCell sourceTile) {
        DungeonTraversalEndpoint sourceEndpoint = endpoint(sourceTile);
        DungeonTraversalEndpoint targetEndpoint = sourceEndpoint == null ? null : oppositeOf(sourceEndpoint);
        if (sourceEndpoint == null || targetEndpoint == null) {
            return null;
        }
        return cardinalDirection(sourceEndpoint.tile(), targetEndpoint.tile());
    }

    public String directionalActionId(DungeonCell sourceTile) {
        return "traversal:" + key + ":" + cellKey(sourceTile);
    }

    private @Nullable DungeonTraversalEndpoint endpoint(DungeonCell tile) {
        if (tile == null) {
            return null;
        }
        if (tile.equals(firstEndpoint.tile())) {
            return firstEndpoint;
        }
        if (tile.equals(secondEndpoint.tile())) {
            return secondEndpoint;
        }
        return null;
    }

    private static @Nullable DungeonEdgeDirection cardinalDirection(DungeonCell source, DungeonCell target) {
        if (source.level() != target.level()) {
            return null;
        }
        int deltaQ = target.q() - source.q();
        int deltaR = target.r() - source.r();
        for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
            if (direction.deltaQ() == deltaQ && direction.deltaR() == deltaR) {
                return direction;
            }
        }
        return null;
    }

    private static String fallbackKey(
            DungeonTraversalSource source,
            DungeonTraversalEndpoint firstEndpoint,
            DungeonTraversalEndpoint secondEndpoint
    ) {
        String sourceKey = source == null
                ? "traversal:0"
                : source.kind().name().toLowerCase(Locale.ROOT) + ":" + source.id();
        DungeonTraversalEndpoint safeFirst = firstEndpoint == null ? defaultEndpoint() : firstEndpoint;
        DungeonTraversalEndpoint safeSecond = secondEndpoint == null ? defaultEndpoint() : secondEndpoint;
        return sourceKey + ":" + cellKey(safeFirst.tile()) + ":" + cellKey(safeSecond.tile());
    }

    private static DungeonTraversalEndpoint defaultEndpoint() {
        return new DungeonTraversalEndpoint(new DungeonCell(0, 0, 0), 0L, "");
    }

    private static String cellKey(@Nullable DungeonCell cell) {
        DungeonCell safeCell = cell == null ? new DungeonCell(0, 0, 0) : cell;
        return safeCell.q() + "," + safeCell.r() + "," + safeCell.level();
    }
}
