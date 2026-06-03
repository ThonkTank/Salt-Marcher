package src.domain.dungeon.model.runtime.travel.projection;


import org.jspecify.annotations.Nullable;

import java.util.Locale;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;

public record TraversalLink(
        String key,
        TraversalSource source,
        TraversalEndpoint firstEndpoint,
        TraversalEndpoint secondEndpoint
) {

    public TraversalLink {
        key = key == null || key.isBlank() ? fallbackKey(source, firstEndpoint, secondEndpoint) : key.trim();
        source = source == null
                ? new TraversalSource(TraversalSourceKind.defaultKind(), 0L, "Tür")
                : source;
        firstEndpoint = firstEndpoint == null ? defaultEndpoint() : firstEndpoint;
        secondEndpoint = secondEndpoint == null ? defaultEndpoint() : secondEndpoint;
    }

    public @Nullable TraversalEndpoint endpointFrom(Set<Cell> cells) {
        if (cells == null || cells.isEmpty()) {
            return null;
        }
        boolean first = cells.contains(firstEndpoint.tile());
        boolean second = cells.contains(secondEndpoint.tile());
        return first == second ? null : first ? firstEndpoint : secondEndpoint;
    }

    public @Nullable TraversalEndpoint oppositeOf(TraversalEndpoint endpoint) {
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

    public TravelHeading headingFrom(Cell sourceTile, TravelHeading currentHeading) {
        TravelHeading fallback = currentHeading == null ? TravelHeading.defaultHeading() : currentHeading;
        Direction direction = directionFrom(sourceTile);
        return direction == null ? fallback : TravelHeading.valueOf(direction.name());
    }

    public @Nullable Direction directionFrom(Cell sourceTile) {
        TraversalEndpoint sourceEndpoint = endpoint(sourceTile);
        TraversalEndpoint targetEndpoint = sourceEndpoint == null ? null : oppositeOf(sourceEndpoint);
        if (sourceEndpoint == null || targetEndpoint == null) {
            return null;
        }
        return cardinalDirection(sourceEndpoint.tile(), targetEndpoint.tile());
    }

    public String directionalActionId(Cell sourceTile) {
        return "traversal:" + key + ":" + cellKey(sourceTile);
    }

    private @Nullable TraversalEndpoint endpoint(Cell tile) {
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

    private static @Nullable Direction cardinalDirection(Cell source, Cell target) {
        if (source.level() != target.level()) {
            return null;
        }
        int deltaQ = target.q() - source.q();
        int deltaR = target.r() - source.r();
        for (Direction direction : Direction.values()) {
            if (direction.deltaQ() == deltaQ && direction.deltaR() == deltaR) {
                return direction;
            }
        }
        return null;
    }

    private static String fallbackKey(
            TraversalSource source,
            TraversalEndpoint firstEndpoint,
            TraversalEndpoint secondEndpoint
    ) {
        String sourceKey = source == null
                ? "traversal:0"
                : source.kind().name().toLowerCase(Locale.ROOT) + ":" + source.id();
        TraversalEndpoint safeFirst = firstEndpoint == null ? defaultEndpoint() : firstEndpoint;
        TraversalEndpoint safeSecond = secondEndpoint == null ? defaultEndpoint() : secondEndpoint;
        String firstKey = cellKey(safeFirst.tile());
        String secondKey = cellKey(safeSecond.tile());
        return String.CASE_INSENSITIVE_ORDER.compare(firstKey, secondKey) <= 0
                ? sourceKey + ":" + firstKey + ":" + secondKey
                : sourceKey + ":" + secondKey + ":" + firstKey;
    }

    private static TraversalEndpoint defaultEndpoint() {
        return new TraversalEndpoint(new Cell(0, 0, 0), 0L, "");
    }

    private static String cellKey(@Nullable Cell cell) {
        Cell safeCell = cell == null ? new Cell(0, 0, 0) : cell;
        return safeCell.q() + "," + safeCell.r() + "," + safeCell.level();
    }
}
