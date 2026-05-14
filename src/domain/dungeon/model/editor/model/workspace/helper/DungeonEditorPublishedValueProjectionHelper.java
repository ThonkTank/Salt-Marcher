package src.domain.dungeon.model.editor.model.workspace.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorCell;
import src.domain.dungeon.published.DungeonEditorEdge;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorPublishedValueProjectionHelper {

    private DungeonEditorPublishedValueProjectionHelper() {
    }

    public static DungeonEditorTopologyElementRef toPublishedTopologyRef(
            DungeonEditorWorkspaceValues.@Nullable TopologyElementRef ref
    ) {
        return ref == null
                ? DungeonEditorTopologyElementRef.empty()
                : new DungeonEditorTopologyElementRef(ref.kind().name(), ref.id());
    }

    public static DungeonEditorHandleRef toPublishedHandleRefOrEmpty(
            DungeonEditorWorkspaceValues.@Nullable HandleRef handleRef
    ) {
        if (handleRef == null) {
            return DungeonEditorHandleRef.empty();
        }
        return new DungeonEditorHandleRef(
                DungeonEditorHandleKind.valueOf(handleRef.kind().name()),
                toDomainTopologyRef(handleRef.topologyRef()),
                handleRef.ownerId(),
                handleRef.clusterId(),
                handleRef.corridorId(),
                handleRef.roomId(),
                handleRef.index(),
                toDomainCell(handleRef.cell()),
                handleRef.direction());
    }

    private static DungeonTopologyElementRef toDomainTopologyRef(
            DungeonEditorWorkspaceValues.@Nullable TopologyElementRef ref
    ) {
        return ref == null
                ? DungeonTopologyElementRef.empty()
                : new DungeonTopologyElementRef(DungeonTopologyElementKind.valueOf(ref.kind().name()), ref.id());
    }

    private static DungeonCellRef toDomainCell(DungeonEditorWorkspaceValues.@Nullable Cell cell) {
        return cell == null ? new DungeonCellRef(0, 0, 0) : new DungeonCellRef(cell.q(), cell.r(), cell.level());
    }

    public static DungeonEditorCell toPublishedCell(DungeonEditorWorkspaceValues.@Nullable Cell cell) {
        return cell == null ? new DungeonEditorCell(0, 0, 0) : new DungeonEditorCell(cell.q(), cell.r(), cell.level());
    }

    public static DungeonEditorEdge toPublishedEdge(DungeonEditorWorkspaceValues.@Nullable Edge edge) {
        if (edge == null) {
            return new DungeonEditorEdge(new DungeonEditorCell(0, 0, 0), new DungeonEditorCell(0, 0, 0));
        }
        return new DungeonEditorEdge(toPublishedCell(edge.from()), toPublishedCell(edge.to()));
    }
}
