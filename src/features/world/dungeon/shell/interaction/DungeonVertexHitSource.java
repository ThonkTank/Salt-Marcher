package features.world.dungeon.shell.interaction;

import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.model.interaction.DungeonSelectionRef;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public final class DungeonVertexHitSource implements DungeonHitSource {

    @Override
    public List<DungeonHitDescriptor> describe(DungeonMap layout, DungeonHitProbe probe) {
        if (probe == null) {
            return List.of();
        }

        ArrayList<DungeonHitDescriptor> descriptors = new ArrayList<>();
        for (GridPoint point2x : cellVertices2x(probe.gridCell())) {
            descriptors.add(new DungeonHitDescriptor(
                    new DungeonSelectionRef.VertexRef(point2x),
                    List.of(new DungeonHitSurface.PointSurface(Set.of(point2x), probe.levelZ()))));
        }
        return List.copyOf(descriptors);
    }

    private static Set<GridPoint> cellVertices2x(GridPoint cell) {
        if (cell == null) {
            return Set.of();
        }
        return Set.of(
                GridPoint.vertex(cell, -1, -1),
                GridPoint.vertex(cell, 1, -1),
                GridPoint.vertex(cell, -1, 1),
                GridPoint.vertex(cell, 1, 1));
    }
}
