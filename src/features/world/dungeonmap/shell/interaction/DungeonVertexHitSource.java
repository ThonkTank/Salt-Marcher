package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;

import java.util.ArrayList;
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
                    new DungeonSelectionRef.VertexRef(point2x),
                    List.of(new DungeonHitSurface.PointSurface(Set.of(point2x), probe.levelZ()))));
        }
        return List.copyOf(descriptors);
    }

    private static Set<GridPoint2x> cellVertices2x(CellCoord cell) {
        if (cell == null) {
            return Set.of();
        }
        return Set.of(
                GridPoint2x.vertex(cell, -1, -1),
                GridPoint2x.vertex(cell, 1, -1),
                GridPoint2x.vertex(cell, -1, 1),
                GridPoint2x.vertex(cell, 1, 1));
    }
}
