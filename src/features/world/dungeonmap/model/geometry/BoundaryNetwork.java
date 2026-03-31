package features.world.dungeonmap.model.geometry;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Canonical combined boundary geometry over multiple boundary paths.
 *
 * <p>This type owns only geometric/topological truth for combined boundaries. It deliberately has no movement
 * semantics, room ownership, or cluster policy.</p>
 */
public final class BoundaryNetwork extends VertexPath {

    public BoundaryNetwork(Collection<VertexEdge> edges) {
        super(edges);
    }

    public static BoundaryNetwork empty() {
        return new BoundaryNetwork(Set.of());
    }

    public static BoundaryNetwork fromPaths(Collection<? extends VertexPath> paths) {
        Set<VertexEdge> edges = new LinkedHashSet<>();
        if (paths != null) {
            for (VertexPath path : paths) {
                if (path != null) {
                    edges.addAll(path.edges());
                }
            }
        }
        return new BoundaryNetwork(edges);
    }

    @Override
    protected BoundaryNetwork recreate(Collection<VertexEdge> edges) {
        return new BoundaryNetwork(edges);
    }
}
