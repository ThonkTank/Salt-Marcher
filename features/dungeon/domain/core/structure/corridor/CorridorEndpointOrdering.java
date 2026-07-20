package features.dungeon.domain.core.structure.corridor;

import java.util.Objects;

/**
 * Owns the stable endpoint order used to derive direction-sensitive corridor routes.
 *
 * <p>Corridor storage groups door bindings before anchor references. Canonical creation and
 * transient route derivation must use that same order so a committed route cannot differ from
 * the route that was validated or previewed.</p>
 */
public final class CorridorEndpointOrdering {
    private CorridorEndpointOrdering() {
    }

    public static InputOrder canonicalOrder(EndpointRole first, EndpointRole second) {
        EndpointRole safeFirst = first == null ? EndpointRole.EMPTY : first;
        EndpointRole safeSecond = second == null ? EndpointRole.EMPTY : second;
        return safeFirst.ordinal() <= safeSecond.ordinal() ? InputOrder.KEEP : InputOrder.SWAP;
    }

    public static OrderedEndpoints canonical(
            DungeonCorridorEndpoint first,
            DungeonCorridorEndpoint second
    ) {
        Objects.requireNonNull(first, "first");
        Objects.requireNonNull(second, "second");
        return canonicalOrder(role(first), role(second)) == InputOrder.KEEP
                ? new OrderedEndpoints(first, second)
                : new OrderedEndpoints(second, first);
    }

    private static EndpointRole role(DungeonCorridorEndpoint endpoint) {
        if (endpoint.isDoorEndpoint()) {
            return EndpointRole.DOOR;
        }
        if (endpoint.isAnchorEndpoint()) {
            return EndpointRole.ANCHOR;
        }
        return EndpointRole.EMPTY;
    }

    public enum EndpointRole {
        DOOR,
        ANCHOR,
        EMPTY
    }

    public enum InputOrder {
        KEEP,
        SWAP
    }

    public record OrderedEndpoints(
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        public OrderedEndpoints {
            Objects.requireNonNull(start, "start");
            Objects.requireNonNull(end, "end");
        }
    }
}
