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

        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (GridPoint2x point2x : cellVertices2x(probe.gridCell())) {
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonHitSubject.VertexSubject(point2x),
                    List.of(new DungeonHitSurface.PointSurface(point2x, probe.levelZ()))));
        }
        return List.copyOf(descriptors);
    }

    private static Set<GridPoint2x> cellVertices2x(Point2i cell) {
        if (cell == null) {
            return Set.of();
        }
        int baseX2 = cell.x() * 2;
        int baseY2 = cell.y() * 2;
        LinkedHashSet<GridPoint2x> vertices = new LinkedHashSet<>();
        vertices.add(GridPoint2x.fromRaw(baseX2, baseY2));
        vertices.add(GridPoint2x.fromRaw(baseX2 + 2, baseY2));
        vertices.add(GridPoint2x.fromRaw(baseX2, baseY2 + 2));
        vertices.add(GridPoint2x.fromRaw(baseX2 + 2, baseY2 + 2));
        return Set.copyOf(vertices);
    }
}
