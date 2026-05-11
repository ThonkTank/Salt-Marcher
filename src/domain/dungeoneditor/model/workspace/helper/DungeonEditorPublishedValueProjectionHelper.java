package src.domain.dungeoneditor.model.workspace.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorCell;
import src.domain.dungeoneditor.published.DungeonEditorEdge;
import src.domain.dungeoneditor.published.DungeonEditorHandleRef;
import src.domain.dungeoneditor.published.DungeonEditorTopologyElementRef;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;

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
                handleRef.kind().name(),
                toPublishedTopologyRef(handleRef.topologyRef()),
                handleRef.ownerId(),
                handleRef.clusterId(),
                handleRef.corridorId(),
                handleRef.roomId(),
                handleRef.index(),
                toPublishedCell(handleRef.cell()),
                handleRef.direction());
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
