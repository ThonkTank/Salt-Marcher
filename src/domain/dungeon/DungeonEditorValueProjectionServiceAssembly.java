package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.model.DungeonTopologyRef;
import src.domain.dungeon.model.worldspace.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;

final class DungeonEditorValueProjectionServiceAssembly {

    private DungeonEditorValueProjectionServiceAssembly() {
    }

    static src.domain.dungeon.published.DungeonOverlaySettings overlay(
            DungeonEditorSessionValues.@Nullable OverlaySettings overlay
    ) {
        DungeonEditorSessionValues.OverlaySettings safeOverlay = overlay == null
                ? DungeonEditorSessionValues.OverlaySettings.defaults()
                : overlay;
        return new src.domain.dungeon.published.DungeonOverlaySettings(
                safeOverlay.modeKey(),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    static DungeonEditorViewMode viewMode(DungeonEditorSessionValues.@Nullable ViewMode viewMode) {
        return viewMode != null && "GRAPH".equals(viewMode.name())
                ? DungeonEditorViewMode.GRAPH
                : DungeonEditorViewMode.GRID;
    }

    static DungeonEditorTool tool(DungeonEditorSessionValues.@Nullable Tool tool) {
        return tool == null ? DungeonEditorTool.SELECT : DungeonEditorTool.valueOf(tool.name());
    }

    static src.domain.dungeon.published.DungeonEditorHandleRef handleRef(
            src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.HandleRef handleRef
    ) {
        if (handleRef == null) {
            return src.domain.dungeon.published.DungeonEditorHandleRef.empty();
        }
        return new src.domain.dungeon.published.DungeonEditorHandleRef(
                src.domain.dungeon.published.DungeonEditorHandleKind.valueOf(handleRef.kind().name()),
                domainTopologyRef(handleRef.topologyRef()),
                handleRef.ownerId(),
                handleRef.clusterId(),
                handleRef.corridorId(),
                handleRef.roomId(),
                handleRef.index(),
                cell(handleRef.cell()),
                handleRef.direction());
    }

    static src.domain.dungeon.published.DungeonEditorTopologyElementRef topologyRef(@Nullable DungeonTopologyRef ref) {
        return ref == null
                ? src.domain.dungeon.published.DungeonEditorTopologyElementRef.empty()
                : new src.domain.dungeon.published.DungeonEditorTopologyElementRef(ref.kind().name(), ref.id());
    }

    static List<src.domain.dungeon.published.DungeonCellRef> cells(
            List<src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.Cell> cells
    ) {
        List<src.domain.dungeon.published.DungeonCellRef> result = new ArrayList<>();
        for (src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.Cell cell
                : cells == null ? List.<src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.Cell>of() : cells) {
            result.add(cell(cell));
        }
        return List.copyOf(result);
    }

    static src.domain.dungeon.published.DungeonCellRef cell(
            src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.Cell mapCell
    ) {
        return mapCell == null
                ? new src.domain.dungeon.published.DungeonCellRef(0, 0, 0)
                : new src.domain.dungeon.published.DungeonCellRef(mapCell.q(), mapCell.r(), mapCell.level());
    }

    static src.domain.dungeon.published.DungeonEdgeRef edge(
            src.domain.dungeon.model.worldspace.model.workspace.model.DungeonEditorWorkspaceValues.Edge mapEdge
    ) {
        if (mapEdge == null) {
            return new src.domain.dungeon.published.DungeonEdgeRef(
                    new src.domain.dungeon.published.DungeonCellRef(0, 0, 0),
                    new src.domain.dungeon.published.DungeonCellRef(0, 0, 0));
        }
        return new src.domain.dungeon.published.DungeonEdgeRef(cell(mapEdge.from()), cell(mapEdge.to()));
    }

    private static src.domain.dungeon.published.DungeonTopologyElementRef domainTopologyRef(@Nullable DungeonTopologyRef ref) {
        return ref == null
                ? src.domain.dungeon.published.DungeonTopologyElementRef.empty()
                : new src.domain.dungeon.published.DungeonTopologyElementRef(
                        src.domain.dungeon.published.DungeonTopologyElementKind.valueOf(ref.kind().name()),
                        ref.id());
    }
}
