package src.domain.dungeon.model.editor.helper;

import src.domain.dungeon.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.map.model.DungeonEditorHandleType;

public final class DungeonEditorProjectionElementProjectionHelper {

    private DungeonEditorProjectionElementProjectionHelper() {
    }

    public static DungeonEditorMapProjectionSnapshot.CellProjection cell(
            DungeonEditorWorkspaceValues.Area area,
            DungeonEditorWorkspaceValues.Cell cell,
            boolean selected,
            boolean preview,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        DungeonEditorMapProjectionSnapshot.CellKind kind = area.kind().isCorridor()
                ? DungeonEditorMapProjectionSnapshot.CellKind.CORRIDOR
                : DungeonEditorMapProjectionSnapshot.CellKind.ROOM;
        return new DungeonEditorMapProjectionSnapshot.CellProjection(
                cell.q() + deltaQ,
                cell.r() + deltaR,
                cell.level() + deltaLevel,
                area.label(),
                kind,
                area.id(),
                area.clusterId(),
                DungeonEditorProjectionPublishedBoundaryTranslationHelper.safeTopologyRef(area.topologyRef()),
                selected,
                false,
                preview,
                false);
    }

    public static DungeonEditorMapProjectionSnapshot.CellProjection featureCell(
            DungeonEditorWorkspaceValues.Feature feature,
            DungeonEditorWorkspaceValues.Cell cell,
            boolean selected
    ) {
        DungeonEditorMapProjectionSnapshot.CellKind kind = feature.kind().isTransition()
                ? DungeonEditorMapProjectionSnapshot.CellKind.TRANSITION
                : DungeonEditorMapProjectionSnapshot.CellKind.STAIR;
        return new DungeonEditorMapProjectionSnapshot.CellProjection(
                cell.q(),
                cell.r(),
                cell.level(),
                feature.label(),
                kind,
                feature.id(),
                0L,
                DungeonEditorProjectionPublishedBoundaryTranslationHelper.safeTopologyRef(feature.topologyRef()),
                selected,
                false,
                false,
                false);
    }

    public static DungeonEditorMapProjectionSnapshot.EdgeProjection edge(
            DungeonEditorWorkspaceValues.Boundary boundary,
            int deltaQ,
            int deltaR,
            int deltaLevel,
            boolean preview,
            boolean selected
    ) {
        DungeonEditorWorkspaceValues.Edge edge = boundary.edge();
        return new DungeonEditorMapProjectionSnapshot.EdgeProjection(
                edge.from().q() + deltaQ,
                edge.from().r() + deltaR,
                edge.to().q() + deltaQ,
                edge.to().r() + deltaR,
                edge.from().level() + deltaLevel,
                DungeonEditorWorkspaceTopologyBoundaryTranslationHelper.toDomainBoundaryKind(boundary.kind()),
                boundary.label(),
                boundary.id(),
                DungeonEditorProjectionPublishedBoundaryTranslationHelper.safeTopologyRef(boundary.topologyRef()),
                selected,
                preview);
    }

    public static DungeonEditorMapProjectionSnapshot.MarkerProjection featureMarker(
            DungeonEditorWorkspaceValues.Feature feature,
            DungeonEditorProjectionGeometryProjectionHelper.CellCenter center,
            int level,
            boolean selected
    ) {
        DungeonEditorMapProjectionSnapshot.MarkerKind kind = feature.kind().isTransition()
                ? DungeonEditorMapProjectionSnapshot.MarkerKind.WAYPOINT
                : DungeonEditorMapProjectionSnapshot.MarkerKind.STAIR;
        String label = feature.kind().isTransition() ? "->" : "z";
        return new DungeonEditorMapProjectionSnapshot.MarkerProjection(
                label,
                center.q(),
                center.r(),
                level,
                kind,
                selected,
                DungeonEditorProjectionPublishedBoundaryTranslationHelper.emptyHandleRef(feature.id(), 0L),
                false);
    }

    public static DungeonEditorMapProjectionSnapshot.MarkerProjection handleMarker(
            DungeonEditorWorkspaceValues.Handle handle,
            DungeonEditorSessionValues.Selection selection,
            boolean preview
    ) {
        DungeonEditorWorkspaceValues.HandleRef ref = handle.ref();
        return new DungeonEditorMapProjectionSnapshot.MarkerProjection(
                handleMarkerLabel(ref.kind()),
                handle.cell().q() + 0.5,
                handle.cell().r() + 0.5,
                handle.cell().level(),
                handleMarkerKind(ref.kind()),
                DungeonEditorProjectionSelectionProjectionHelper.selectedHandle(ref, selection),
                DungeonEditorPublishedValueProjectionHelper.toPublishedHandleRefOrEmpty(ref),
                preview);
    }

    public static DungeonEditorMapProjectionSnapshot.LabelProjection clusterLabel(
            DungeonEditorWorkspaceValues.Handle handle,
            boolean selected,
            boolean preview,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        DungeonEditorWorkspaceValues.Cell cell = handle.cell();
        DungeonEditorWorkspaceValues.HandleRef ref = handle.ref();
        return new DungeonEditorMapProjectionSnapshot.LabelProjection(
                handle.label(),
                cell.q() + deltaQ + 0.5,
                cell.r() + deltaR + 0.5,
                cell.level() + deltaLevel,
                ref.ownerId(),
                ref.clusterId(),
                DungeonEditorProjectionPublishedBoundaryTranslationHelper.safeTopologyRef(ref.topologyRef()),
                selected,
                preview);
    }

    public static DungeonEditorMapProjectionSnapshot.MarkerKind handleMarkerKind(DungeonEditorHandleType kind) {
        if (kind == DungeonEditorHandleType.DOOR) {
            return DungeonEditorMapProjectionSnapshot.MarkerKind.DOOR;
        }
        if (kind == DungeonEditorHandleType.STAIR_ANCHOR) {
            return DungeonEditorMapProjectionSnapshot.MarkerKind.STAIR;
        }
        return DungeonEditorMapProjectionSnapshot.MarkerKind.WAYPOINT;
    }

    public static String handleMarkerLabel(DungeonEditorHandleType kind) {
        if (kind == DungeonEditorHandleType.DOOR) {
            return "D";
        }
        if (kind == DungeonEditorHandleType.STAIR_ANCHOR) {
            return "z";
        }
        if (kind == DungeonEditorHandleType.CORRIDOR_ANCHOR) {
            return "o";
        }
        if (kind == DungeonEditorHandleType.CORRIDOR_WAYPOINT) {
            return "•";
        }
        return "";
    }
}
