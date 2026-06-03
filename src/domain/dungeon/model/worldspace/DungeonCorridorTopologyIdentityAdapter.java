package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.structure.corridor.Corridor;
import src.domain.dungeon.model.core.structure.corridor.CorridorNetwork;

final class DungeonCorridorTopologyIdentityAdapter {

    private DungeonCorridorTopologyIdentityAdapter() {
    }

    static CorridorNetwork toCoreNetwork(List<DungeonCorridor> corridors) {
        List<Corridor> result = new ArrayList<>();
        for (DungeonCorridor corridor : corridors == null ? List.<DungeonCorridor>of() : corridors) {
            if (corridor != null) {
                result.add(toCore(corridor));
            }
        }
        return new CorridorNetwork(result);
    }

    static List<DungeonCorridor> fromCoreNetwork(List<DungeonCorridor> sources, CorridorNetwork network) {
        List<DungeonCorridor> result = new ArrayList<>();
        for (Corridor coreCorridor : network.corridors()) {
            DungeonCorridor source = sourceById(sources, coreCorridor.corridorId());
            if (source != null) {
                result.add(fromCore(source, coreCorridor));
            }
        }
        return List.copyOf(result);
    }

    private static Corridor toCore(DungeonCorridor source) {
        return new Corridor(
                source.corridorId(),
                source.mapId(),
                source.level(),
                source.roomIds(),
                DungeonCorridorTopologyIdentityBindingsAdapter.toCore(source.bindings()));
    }

    private static DungeonCorridor fromCore(DungeonCorridor source, Corridor coreCorridor) {
        return new DungeonCorridor(
                coreCorridor.corridorId(),
                coreCorridor.mapId(),
                coreCorridor.level(),
                coreCorridor.roomIds(),
                DungeonCorridorTopologyIdentityBindingsAdapter.fromCore(
                        source.bindings(),
                        coreCorridor.bindings()));
    }

    private static DungeonCorridor sourceById(List<DungeonCorridor> sources, long corridorId) {
        for (DungeonCorridor source : sources == null ? List.<DungeonCorridor>of() : sources) {
            if (source != null && source.corridorId() == corridorId) {
                return source;
            }
        }
        return null;
    }
}
