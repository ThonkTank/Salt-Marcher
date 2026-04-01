package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.Point2i;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class DungeonVertexHitSource implements DungeonHitSource {

    @Override
    public List<DungeonHitDescriptor> describe(DungeonLayout layout, DungeonHitProbe probe) {
        if (probe == null) {
            return List.of();
        }

        Set<Point2i> vertices = new LinkedHashSet<>();
        Point2i cell = probe.gridCell();
        vertices.add(new Point2i(cell.x(), cell.y()));
        vertices.add(new Point2i(cell.x() + 1, cell.y()));
        vertices.add(new Point2i(cell.x(), cell.y() + 1));
        vertices.add(new Point2i(cell.x() + 1, cell.y() + 1));

        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (Point2i vertex : vertices) {
            GridPoint2x point2x = GridPoint2x.fromVertex(vertex);
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonHitSubject.VertexSubject(point2x),
                    List.of(new DungeonHitSurface.PointSurface(point2x, probe.levelZ()))));
        }
        return List.copyOf(descriptors);
    }
}
