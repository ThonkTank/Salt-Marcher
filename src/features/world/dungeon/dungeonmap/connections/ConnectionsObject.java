package features.world.dungeon.dungeonmap.connections;

/**
 * Public root owner seam for shared dungeon connection semantics.
 *
 * <p>The current connection owner is value-centric: cluster, corridor, and transition workflows still build the
 * canonical connection instances themselves, while this seam marks the shared semantic family and its public home.</p>
 */
public final class ConnectionsObject {

    private ConnectionsObject() {
        throw new AssertionError("No instances");
    }
}
