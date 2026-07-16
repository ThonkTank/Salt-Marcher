package features.dungeon.application.editor;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.api.DungeonEditorTool;
import features.dungeon.api.DungeonEditorViewMode;

final class DungeonEditorValueProjectionServiceAssembly {

    private DungeonEditorValueProjectionServiceAssembly() {
    }

    static features.dungeon.api.DungeonOverlaySettings overlay(
            DungeonEditorSessionValues.@Nullable OverlaySettings overlay
    ) {
        DungeonEditorSessionValues.OverlaySettings safeOverlay = overlay == null
                ? DungeonEditorSessionValues.OverlaySettings.defaults()
                : overlay;
        return new features.dungeon.api.DungeonOverlaySettings(
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

    static features.dungeon.api.DungeonEditorHandleRef handleRef(
            features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.HandleRef handleRef
    ) {
        if (handleRef == null) {
            return features.dungeon.api.DungeonEditorHandleRef.empty();
        }
        return new features.dungeon.api.DungeonEditorHandleRef(
                features.dungeon.api.DungeonEditorHandleKind.valueOf(handleRef.kind().name()),
                domainTopologyRef(handleRef.topologyRef()),
                handleRef.ownerId(),
                handleRef.clusterId(),
                handleRef.corridorId(),
                handleRef.roomId(),
                handleRef.index(),
                cell(handleRef.cell()),
                handleRef.direction(),
                handleRef.sourceEdge() == null ? null : edge(handleRef.sourceEdge()),
                edges(handleRef.sourceEdges()));
    }

    private static List<features.dungeon.api.DungeonEdgeRef> edges(
            List<features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Edge> edges
    ) {
        return edges == null
                ? List.of()
                : edges.stream().map(DungeonEditorValueProjectionServiceAssembly::edge).toList();
    }

    static features.dungeon.api.DungeonEditorTopologyElementRef topologyRef(@Nullable DungeonTopologyRef ref) {
        return ref == null
                ? features.dungeon.api.DungeonEditorTopologyElementRef.empty()
                : new features.dungeon.api.DungeonEditorTopologyElementRef(ref.kind().name(), ref.id());
    }

    static List<features.dungeon.api.DungeonCellRef> cells(
            List<features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Cell> cells
    ) {
        List<features.dungeon.api.DungeonCellRef> result = new ArrayList<>();
        for (features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Cell cell
                : cells == null ? List.<features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Cell>of() : cells) {
            result.add(cell(cell));
        }
        return List.copyOf(result);
    }

    static features.dungeon.api.DungeonCellRef cell(
            features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Cell mapCell
    ) {
        return mapCell == null
                ? new features.dungeon.api.DungeonCellRef(0, 0, 0)
                : new features.dungeon.api.DungeonCellRef(mapCell.q(), mapCell.r(), mapCell.level());
    }

    static features.dungeon.api.DungeonEdgeRef edge(
            features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Edge mapEdge
    ) {
        if (mapEdge == null) {
            return new features.dungeon.api.DungeonEdgeRef(
                    new features.dungeon.api.DungeonCellRef(0, 0, 0),
                    new features.dungeon.api.DungeonCellRef(0, 0, 0));
        }
        return new features.dungeon.api.DungeonEdgeRef(cell(mapEdge.from()), cell(mapEdge.to()));
    }

    private static features.dungeon.api.DungeonTopologyElementRef domainTopologyRef(@Nullable DungeonTopologyRef ref) {
        return ref == null
                ? features.dungeon.api.DungeonTopologyElementRef.empty()
                : new features.dungeon.api.DungeonTopologyElementRef(
                        features.dungeon.api.DungeonTopologyElementKind.valueOf(ref.kind().name()),
                        ref.id());
    }
}
