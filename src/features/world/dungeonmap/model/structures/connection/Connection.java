package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.map.model.DungeonLayout;
import features.world.dungeonmap.geometry.CardinalDirection;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridSegment;
import features.world.dungeonmap.map.structure.model.boundary.door.Door;
import features.world.dungeonmap.map.structure.model.boundary.door.DoorRef;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Shared connectivity contract for dungeon structures.
 *
 * <p>The connection itself owns semantic connectivity, physical carrier data, entry resolution, and occupiable
 * surface projection. Carrier types remain passive geometry/state holders only.</p>
 */
public interface Connection {

    long mapId();

    int levelZ();

    Long ownerId();

    ConnectionCarrier carrier();

    List<ConnectionEndpoint> endpoints();

    ConnectionKind kind();

    default DoorRef doorRef() {
        DoorConnectionCarrier carrier = doorCarrier();
        return carrier == null ? null : carrier.doorRef();
    }

    default DoorConnectionCarrier doorCarrier() {
        return carrier() instanceof DoorConnectionCarrier doorCarrier ? doorCarrier : null;
    }

    default StairConnectionCarrier stairCarrier() {
        return carrier() instanceof StairConnectionCarrier stairCarrier ? stairCarrier : null;
    }

    default GridSegment anchorSegment(DungeonLayout layout) {
        Door door = door(layout);
        return door == null ? null : door.anchorSegment();
    }

    default Door door(DungeonLayout layout) {
        DoorRef doorRef = doorRef();
        return layout == null || doorRef == null ? null : layout.resolveDoor(doorRef);
    }

    default Set<GridSegment> boundarySegments(DungeonLayout layout) {
        Door door = door(layout);
        if (door == null) {
            return Set.of();
        }
        if (!door.hasBoundarySegments()) {
            return Set.of();
        }
        return door.boundarySegments();
    }

    default boolean blocksPassage(DungeonLayout layout) {
        Door door = door(layout);
        return door != null && door.blocksPassage();
    }

    default boolean isTraversable(DungeonLayout layout) {
        if (doorCarrier() != null) {
            Door door = door(layout);
            return door != null && !door.blocksPassage();
        }
        return stairCarrier() != null;
    }

    default Set<Integer> occupiedLevels() {
        StairConnectionCarrier stairCarrier = stairCarrier();
        if (stairCarrier == null) {
            return Set.of(levelZ());
        }
        LinkedHashSet<Integer> levels = new LinkedHashSet<>();
        for (GridPoint point : stairCarrier.path()) {
            if (point != null) {
                levels.add(point.z());
            }
        }
        return levels.isEmpty() ? Set.of(levelZ()) : Set.copyOf(levels);
    }

    default GridPoint entryPoint(DungeonLayout layout) {
        StairConnectionCarrier stairCarrier = stairCarrier();
        if (stairCarrier != null) {
            return stairCarrier.anchorCell() == null ? null : stairCarrier.anchorCell().withLevel(stairCarrier.anchorLevelZ());
        }
        ConnectionEndpoint endpoint = entryEndpoint();
        GridSegment anchorSegment = anchorSegment(layout);
        if (layout == null || endpoint == null || anchorSegment == null) {
            return null;
        }
        DungeonLayout.ConnectionSurfaceDescription surface = layout.describeConnectionSurface(
                endpoint,
                anchorSegment,
                levelZ());
        return surface == null || surface.localCell() == null ? null : surface.localCell().withLevel(levelZ());
    }

    default CardinalDirection entryHeading(DungeonLayout layout) {
        ConnectionEndpoint endpoint = entryEndpoint();
        GridSegment anchorSegment = anchorSegment(layout);
        if (layout == null || endpoint == null || anchorSegment == null) {
            return null;
        }
        DungeonLayout.ConnectionSurfaceDescription surface = layout.describeConnectionSurface(
                endpoint,
                anchorSegment,
                levelZ());
        return surface == null ? null : surface.outwardDirection();
    }

    default GridPoint focusPosition(DungeonLayout layout) {
        StairConnectionCarrier stairCarrier = stairCarrier();
        if (stairCarrier != null) {
            return stairCarrier.anchorCell() == null ? null : stairCarrier.anchorCell().withLevel(stairCarrier.anchorLevelZ());
        }
        return entryPoint(layout);
    }

    default Set<GridPoint> occupiedPositions(DungeonLayout layout) {
        StairConnectionCarrier stairCarrier = stairCarrier();
        if (stairCarrier != null) {
            return stairCarrier.occupiedPositions();
        }
        GridPoint focus = focusPosition(layout);
        return focus == null ? Set.of() : Set.of(focus);
    }

    default ConnectionEndpoint entryEndpoint() {
        List<ConnectionEndpoint> endpoints = endpoints();
        if (endpoints == null || endpoints.isEmpty()) {
            return null;
        }
        ConnectionEndpoint transitionEndpoint = endpoints.stream()
                .filter(endpoint -> endpoint != null && endpoint.type() == ConnectionEndpointType.TRANSITION)
                .findFirst()
                .orElse(null);
        if (transitionEndpoint != null) {
            ConnectionEndpoint opposite = oppositeOf(transitionEndpoint);
            if (opposite != null) {
                return opposite;
            }
        }
        return endpoints.stream()
                .filter(endpoint -> endpoint != null && endpoint.type() != ConnectionEndpointType.TRANSITION)
                .findFirst()
                .orElseGet(() -> endpoints.stream().filter(Objects::nonNull).findFirst().orElse(null));
    }

    default boolean touchesEndpoint(ConnectionEndpoint endpoint) {
        return endpoint != null && endpoints().contains(endpoint);
    }

    default ConnectionEndpoint oppositeOf(ConnectionEndpoint endpoint) {
        if (endpoint == null) {
            return null;
        }
        List<ConnectionEndpoint> endpoints = endpoints();
        if (endpoints == null || endpoints.size() != 2 || !endpoints.contains(endpoint)) {
            return null;
        }
        return endpoints.get(0).equals(endpoint) ? endpoints.get(1) : endpoints.get(0);
    }

    default ConnectionTraversalTarget resolveTraversalTarget(
            DungeonLayout layout,
            ConnectionEndpoint activeEndpoint
    ) {
        ConnectionEndpoint destinationEndpoint = activeEndpoint == null ? null : oppositeOf(activeEndpoint);
        if (destinationEndpoint == null) {
            return null;
        }
        if (destinationEndpoint.type() == ConnectionEndpointType.TRANSITION) {
            return new ConnectionTraversalTarget(null, levelZ(), null, destinationEndpoint.id());
        }
        GridSegment anchorSegment = anchorSegment(layout);
        if (layout == null || anchorSegment == null) {
            return null;
        }
        DungeonLayout.ConnectionSurfaceDescription surface = layout.describeConnectionSurface(
                destinationEndpoint,
                anchorSegment,
                levelZ());
        return surface == null
                ? null
                : new ConnectionTraversalTarget(
                        surface.localCell(),
                        levelZ(),
                        surface.outwardDirection(),
                        null);
    }
}
