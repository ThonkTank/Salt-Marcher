package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonAreaType;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonTopology;
import src.domain.dungeon.map.value.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.DungeonTopologyKind;

public final class DungeonTopologyBoundaryTranslator {

    private DungeonTopologyBoundaryTranslator() {
    }

    public static DungeonTopologyElementRef topologyRef(@Nullable DungeonTopologyRef ref) {
        if (ref == null) {
            return DungeonTopologyElementRef.empty();
        }
        return new DungeonTopologyElementRef(
                src.domain.dungeon.published.DungeonTopologyElementKind.valueOf(ref.kind().name()),
                ref.id());
    }

    public static DungeonTopologyRef domainTopologyRef(@Nullable DungeonTopologyElementRef ref) {
        if (ref == null) {
            return DungeonTopologyRef.empty();
        }
        return new DungeonTopologyRef(
                src.domain.dungeon.map.value.DungeonTopologyElementKind.valueOf(ref.kind().name()),
                ref.id());
    }

    public static DungeonClusterBoundaryKind domainBoundaryKind(@Nullable DungeonBoundaryKind kind) {
        return kind == DungeonBoundaryKind.DOOR
                ? DungeonClusterBoundaryKind.DOOR
                : DungeonClusterBoundaryKind.WALL;
    }

    public static DungeonTopologyKind topology(DungeonTopology topology) {
        return topology == DungeonTopology.HEX ? DungeonTopologyKind.HEX : DungeonTopologyKind.SQUARE;
    }

    public static DungeonAreaKind areaKind(DungeonAreaType kind) {
        return kind == DungeonAreaType.CORRIDOR ? DungeonAreaKind.CORRIDOR : DungeonAreaKind.ROOM;
    }
}
