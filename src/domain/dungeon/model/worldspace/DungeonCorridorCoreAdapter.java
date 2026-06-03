package src.domain.dungeon.model.worldspace;

final class DungeonCorridorCoreAdapter {

    private DungeonCorridorCoreAdapter() {
    }

    static src.domain.dungeon.model.core.structure.corridor.Corridor toCore(DungeonCorridor source) {
        return new src.domain.dungeon.model.core.structure.corridor.Corridor(
                source.corridorId(),
                source.mapId(),
                source.level(),
                source.roomIds(),
                DungeonCorridorBindingsCoreAdapter.toCore(source.bindings()));
    }

    static DungeonCorridor fromCore(
            DungeonCorridor source,
            src.domain.dungeon.model.core.structure.corridor.Corridor coreCorridor,
            DungeonCorridorDoorBinding replacementDoor
    ) {
        return new DungeonCorridor(
                coreCorridor.corridorId(),
                coreCorridor.mapId(),
                coreCorridor.level(),
                coreCorridor.roomIds(),
                DungeonCorridorBindingsCoreAdapter.fromCore(
                        source.bindings(),
                        coreCorridor.bindings(),
                        replacementDoor));
    }

}
