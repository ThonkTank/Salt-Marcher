package features.world.dungeonmap.model.structures.connection;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.objects.Door;

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

    default Door door() {
        DoorConnectionCarrier carrier = doorCarrier();
        return carrier == null ? null : carrier.door();
    }

    default DoorConnectionCarrier doorCarrier() {
        return carrier() instanceof DoorConnectionCarrier doorCarrier ? doorCarrier : null;
    }

    default StairConnectionCarrier stairCarrier() {
        return carrier() instanceof StairConnectionCarrier stairCarrier ? stairCarrier : null;
    }

    default GridSegment2x anchorSegment2x() {
        DoorConnectionCarrier carrier = doorCarrier();
        return carrier == null ? null : carrier.anchorSegment2x();
    }

    default boolean isTraversable() {
        Door door = door();
        if (door != null) {
            return !door.blocksPassage();
        }
        return stairCarrier() != null;
    }

    default Set<Integer> occupiedLevels() {
        StairConnectionCarrier stairCarrier = stairCarrier();
        if (stairCarrier == null) {
            return Set.of(levelZ());
        }
        LinkedHashSet<Integer> levels = new LinkedHashSet<>();
        for (CubePoint point : stairCarrier.path()) {
            if (point != null) {
                levels.add(point.z());
            }
        }
        return levels.isEmpty() ? Set.of(levelZ()) : Set.copyOf(levels);
    }

    default CubePoint entryPoint(DungeonLayout layout) {
        StairConnectionCarrier stairCarrier = stairCarrier();
        if (stairCarrier != null) {
            return CubePoint.at(stairCarrier.anchorCell(), stairCarrier.anchorLevelZ());
        }
        ConnectionEndpoint endpoint = entryEndpoint();
        GridSegment2x anchorSegment2x = anchorSegment2x();
        if (layout == null || endpoint == null || anchorSegment2x == null) {
            return null;
        }
        DungeonLayout.ConnectionSurfaceDescription surface = layout.describeConnectionSurface(
                endpoint,
                anchorSegment2x,
                levelZ());
        return surface == null ? null : CubePoint.at(surface.localCell(), levelZ());
    }

    default CardinalDirection entryHeading(DungeonLayout layout) {
        ConnectionEndpoint endpoint = entryEndpoint();
        GridSegment2x anchorSegment2x = anchorSegment2x();
        if (layout == null || endpoint == null || anchorSegment2x == null) {
            return null;
        }
        DungeonLayout.ConnectionSurfaceDescription surface = layout.describeConnectionSurface(
                endpoint,
                anchorSegment2x,
                levelZ());
        return surface == null ? null : surface.outwardDirection();
    }

    default CubePoint focusPosition(DungeonLayout layout) {
        StairConnectionCarrier stairCarrier = stairCarrier();
        if (stairCarrier != null) {
            return CubePoint.at(stairCarrier.anchorCell(), stairCarrier.anchorLevelZ());
        }
        return entryPoint(layout);
    }

    default Set<CubePoint> occupiedPositions(DungeonLayout layout) {
        StairConnectionCarrier stairCarrier = stairCarrier();
        if (stairCarrier != null) {
            return stairCarrier.pathPositions();
        }
        CubePoint focus = focusPosition(layout);
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
}
