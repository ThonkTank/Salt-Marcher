package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
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
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonHitSubject.VertexSubject(vertex),
                    List.of(new DungeonHitSurface.DoubledPointSurface(
                            new Point2i(vertex.x() * 2, vertex.y() * 2),
                            probe.levelZ()))));
        }
        return List.copyOf(descriptors);
    }
}
