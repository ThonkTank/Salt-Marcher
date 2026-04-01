package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.GridShapes;

import java.util.List;

public final class DungeonFloorHitSource implements DungeonHitSource {

    @Override
    public List<DungeonHitDescriptor> describe(DungeonLayout layout, DungeonHitProbe probe) {
        if (probe == null) {
            return List.of();
        }
        return List.of(new DungeonHitDescriptor(
                new DungeonHitSubject.FloorCellSubject(probe.gridCell(), probe.levelZ()),
                List.of(new DungeonHitSurface.ShapeSurface(GridShapes.tile(probe.gridCell()), probe.levelZ()))));
    }
}
