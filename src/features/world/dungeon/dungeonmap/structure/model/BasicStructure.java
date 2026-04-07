package features.world.dungeon.dungeonmap.structure.model;

import features.world.dungeon.dungeonmap.structure.model.room.StructureRoomTopology;

import java.util.Map;

final class BasicStructure extends Structure {

    BasicStructure(
            Map<Integer, LevelStructure> levelsByZ,
            StructureRoomTopology roomTopology
    ) {
        super(levelsByZ, roomTopology);
    }

    @Override
    protected Structure recreate(
            Map<Integer, LevelStructure> levelsByZ,
            StructureRoomTopology roomTopology
    ) {
        return new BasicStructure(levelsByZ, roomTopology);
    }
}
