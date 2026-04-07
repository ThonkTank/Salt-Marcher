package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.map.model.DungeonLayout;

import java.util.List;

@FunctionalInterface
public interface DungeonHitSource {

    List<DungeonHitDescriptor> describe(DungeonLayout layout, DungeonHitProbe probe);
}
