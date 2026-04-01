package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.geometry.VertexPath;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public final class Wall extends VertexPath {

    private final List<GridSegment2x> segments2x;

    // A wall is a path-shaped object whose only added domain rule is that passage is always blocked.
    public Wall(Collection<VertexEdge> edges) {
        super(edges);
        this.segments2x = edges().stream()
                .map(GridSegment2x::fromVertexEdge)
                .sorted(GridSegment2x.SEGMENT_ORDER)
                .toList();
    }

    public static Wall fromSegments(Collection<GridSegment2x> segments) {
        ArrayList<VertexEdge> edges = new ArrayList<>();
        if (segments != null) {
            segments.stream()
                    .filter(segment -> segment != null)
                    .sorted(GridSegment2x.SEGMENT_ORDER)
                    .forEach(segment -> segment.toVertexEdge().ifPresent(edges::add));
        }
        return new Wall(edges);
    }

    protected VertexPath recreate(Collection<VertexEdge> edges) {
        return new Wall(edges);
    }

    public List<GridSegment2x> segments2x() {
        return segments2x;
    }

    public Wall movedBy(Point2i delta) {
        return (Wall) translated(delta);
    }

    public static Wall between(Point2i start, Point2i end) {
        return new Wall(java.util.Set.of(new VertexEdge(start, end)));
    }

    public boolean blocksPassage() {
        return true;
    }
}
