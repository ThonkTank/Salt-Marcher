package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonTopologyElementKind;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonTopologyElementRef;

final class DungeonEditorOperationRefsUseCase {

    private DungeonEditorOperationRefsUseCase() {
    }

    static DungeonTopologyRef topologyRef(@Nullable DungeonTopologyElementRef ref) {
        if (ref == null) {
            return DungeonTopologyRef.empty();
        }
        return new DungeonTopologyRef(DungeonTopologyElementKind.valueOf(ref.kind().name()), ref.id());
    }

    static DungeonCell cell(@Nullable DungeonCellRef cell) {
        return cell == null ? originCell() : new DungeonCell(cell.q(), cell.r(), cell.level());
    }

    static DungeonCell originCell() {
        return new DungeonCell(0, 0, 0);
    }

    static DungeonEdge edge(@Nullable DungeonEdgeRef edge) {
        if (edge == null) {
            DungeonCell origin = originCell();
            return new DungeonEdge(origin, origin);
        }
        return new DungeonEdge(cell(edge.from()), cell(edge.to()));
    }
}
