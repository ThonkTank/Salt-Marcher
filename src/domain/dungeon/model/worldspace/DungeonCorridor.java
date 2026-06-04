package src.domain.dungeon.model.worldspace;


import java.util.List;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorBindings;

public record DungeonCorridor(
        long corridorId,
        long mapId,
        int level,
        List<Long> roomIds,
        DungeonCorridorBindings bindings
) {
    public DungeonCorridor {
        Corridor coreCorridor = new Corridor(corridorId, mapId, level, roomIds, coreBindings(bindings));
        corridorId = coreCorridor.corridorId();
        mapId = coreCorridor.mapId();
        roomIds = coreCorridor.roomIds();
        bindings = bindings == null ? DungeonCorridorBindings.empty() : bindings;
    }

    @Override
    public List<Long> roomIds() {
        return List.copyOf(roomIds);
    }

    public boolean isReadable() {
        return DungeonCorridorCoreAdapter.toCore(this).isReadable();
    }

    public DungeonCorridor withBindings(DungeonCorridorBindings nextBindings) {
        return new DungeonCorridor(corridorId, mapId, level, roomIds, nextBindings);
    }

    private static CorridorBindings coreBindings(DungeonCorridorBindings bindings) {
        return DungeonCorridorBindingsCoreAdapter.toCore(bindings == null ? DungeonCorridorBindings.empty() : bindings);
    }
}
