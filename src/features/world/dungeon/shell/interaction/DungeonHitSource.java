package features.world.dungeon.shell.interaction;

import features.world.dungeon.dungeonmap.model.DungeonMap;

import java.util.List;

@FunctionalInterface
public interface DungeonHitSource {

    List<DungeonHitDescriptor> describe(DungeonMap layout, DungeonHitProbe probe);
}
