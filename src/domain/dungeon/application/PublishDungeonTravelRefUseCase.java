package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonTopologyElementRef;

final class PublishDungeonTravelRefUseCase {

    private PublishDungeonTravelRefUseCase() {
    }

    static DungeonTopologyElementRef topologyRef(@Nullable DungeonTopologyRef ref) {
        if (ref == null) {
            return DungeonTopologyElementRef.empty();
        }
        return new DungeonTopologyElementRef(
                src.domain.dungeon.published.DungeonTopologyElementKind.valueOf(ref.kind().name()),
                ref.id());
    }

    static DungeonMapId id(@Nullable DungeonMapIdentity identity) {
        return new DungeonMapId(identity == null ? 1L : identity.value());
    }

    static DungeonCellRef cell(DungeonCell cell) {
        return new DungeonCellRef(cell.q(), cell.r(), cell.level());
    }

    static DungeonEdgeRef edge(DungeonEdge edge) {
        return new DungeonEdgeRef(cell(edge.from()), cell(edge.to()));
    }
}
