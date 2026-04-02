package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;

import java.util.List;
import java.util.Set;

public final class DungeonFloorHitSource implements DungeonHitSource {

    @Override
    public List<DungeonHitDescriptor> describe(DungeonLayout layout, DungeonHitProbe probe) {
        if (probe == null) {
            return List.of();
        }
        return List.of(new DungeonHitDescriptor(
                new DungeonHitSubject.FloorCellSubject(probe.gridCell(), probe.levelZ()),
                List.of(new DungeonHitSurface.TileSurface(Set.of(probe.gridCell()), probe.levelZ()))));
    }
}
