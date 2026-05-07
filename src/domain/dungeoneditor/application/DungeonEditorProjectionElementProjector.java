package src.domain.dungeoneditor.application;

import src.domain.dungeoneditor.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorProjectionElementProjector {

    private DungeonEditorProjectionElementProjector() {
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
                DungeonEditorProjectionPublishedBoundaryTranslator.safeTopologyRef(area.topologyRef()),
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
                DungeonEditorProjectionPublishedBoundaryTranslator.safeTopologyRef(feature.topologyRef()),
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
        DungeonEditorMapProjectionSnapshot.EdgeKind kind = boundary.kind().isDoor()
                ? DungeonEditorMapProjectionSnapshot.EdgeKind.DOOR
                : DungeonEditorMapProjectionSnapshot.EdgeKind.WALL;
        return new DungeonEditorMapProjectionSnapshot.EdgeProjection(
                edge.from().q() + deltaQ,
                edge.from().r() + deltaR,
                edge.to().q() + deltaQ,
                edge.to().r() + deltaR,
                edge.from().level() + deltaLevel,
                kind,
                boundary.label(),
                boundary.id(),
                DungeonEditorProjectionPublishedBoundaryTranslator.safeTopologyRef(boundary.topologyRef()),
                selected,
                preview);
    }

    public static DungeonEditorMapProjectionSnapshot.MarkerProjection featureMarker(
            DungeonEditorWorkspaceValues.Feature feature,
            DungeonEditorProjectionGeometryProjector.CellCenter center,
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
                DungeonEditorProjectionPublishedBoundaryTranslator.emptyHandleRef(feature.id(), 0L),
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
                DungeonEditorProjectionSelectionProjector.selectedHandle(ref, selection),
                DungeonEditorPublishedValueProjector.toPublishedHandleRefOrEmpty(ref),
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
                DungeonEditorProjectionPublishedBoundaryTranslator.safeTopologyRef(ref.topologyRef()),
                selected,
                preview);
    }

    public static DungeonEditorMapProjectionSnapshot.MarkerKind handleMarkerKind(DungeonEditorWorkspaceValues.HandleKind kind) {
        return switch (kind) {
            case DOOR -> DungeonEditorMapProjectionSnapshot.MarkerKind.DOOR;
            case STAIR_ANCHOR -> DungeonEditorMapProjectionSnapshot.MarkerKind.STAIR;
            case CORRIDOR_ANCHOR, CORRIDOR_WAYPOINT, CLUSTER_LABEL ->
                    DungeonEditorMapProjectionSnapshot.MarkerKind.WAYPOINT;
        };
    }

    public static String handleMarkerLabel(DungeonEditorWorkspaceValues.HandleKind kind) {
        return switch (kind) {
            case DOOR -> "D";
            case STAIR_ANCHOR -> "z";
            case CORRIDOR_ANCHOR -> "o";
            case CORRIDOR_WAYPOINT -> "•";
            case CLUSTER_LABEL -> "";
        };
    }
}
