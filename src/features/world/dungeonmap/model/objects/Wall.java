package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.geometry.VertexPath;

import java.util.Collection;

public final class Wall extends VertexPath {

    // A wall is a path-shaped object whose only added domain rule is that traversal is always blocked.
    public Wall(Collection<VertexEdge> edges) {
        super(edges);
    }

    protected VertexPath recreate(Collection<VertexEdge> edges) {
        return new Wall(edges);
    }

    public Wall movedBy(Point2i delta) {
        return (Wall) translated(delta);
    }

    public static Wall between(Point2i start, Point2i end) {
        return new Wall(java.util.Set.of(new VertexEdge(start, end)));
    }

    public boolean blocksTraversal() {
        return true;
    }
}
