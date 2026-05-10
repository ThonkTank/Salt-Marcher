package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonEditorHandle;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonTopologyElementRef;

final class PublishDungeonAuthoredRefUseCase {

    private PublishDungeonAuthoredRefUseCase() {
    }

    static DungeonEditorHandleRef handleRef(DungeonEditorHandle handle) {
        return new DungeonEditorHandleRef(
                DungeonEditorHandleKind.valueOf(handle.type().name()),
                topologyRef(handle.topologyRef()),
                handle.ownerId(),
                handle.clusterId(),
                handle.corridorId(),
                handle.roomId(),
                handle.index(),
                cell(handle.cell()),
                handle.direction().name());
    }

    static DungeonTopologyElementRef topologyRef(@Nullable DungeonTopologyRef ref) {
        if (ref == null) {
            return DungeonTopologyElementRef.empty();
        }
        return new DungeonTopologyElementRef(
                src.domain.dungeon.published.DungeonTopologyElementKind.valueOf(ref.kind().name()),
                ref.id());
    }

    static DungeonCellRef cell(DungeonCell cell) {
        return new DungeonCellRef(cell.q(), cell.r(), cell.level());
    }

    static DungeonEdgeRef edge(DungeonEdge edge) {
        return new DungeonEdgeRef(cell(edge.from()), cell(edge.to()));
    }
}
