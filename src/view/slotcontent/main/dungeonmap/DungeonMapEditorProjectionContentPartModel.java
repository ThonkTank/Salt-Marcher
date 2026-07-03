package src.view.slotcontent.main.dungeonmap;

import java.util.List;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.Cell;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.CellKind;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.Edge;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.EdgeKind;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.Label;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.Marker;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.MarkerHandle;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.MarkerKind;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState.TopologyRef;

final class DungeonMapEditorProjectionContentPartModel {
    private static final String STAIR_KIND = "STAIR";
    private DungeonMapEditorProjectionContentPartModel() {
    }

    static Label roomLabel(
            String label,
            long ownerId,
            long clusterId,
            TopologyRef topologyRef,
            List<Cell> areaCells,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel,
            boolean selected,
            boolean preview
    ) {
        DungeonMapRoomLabelPlacementContentPartModel safePlacementModel =
                roomLabelPlacementContentPartModel == null
                        ? new DungeonMapRoomLabelPlacementContentPartModel()
                        : roomLabelPlacementContentPartModel;
        DungeonMapRoomLabelPlacementContentPartModel.RoomLabelPlacement placement =
                safePlacementModel.placementFor(areaCells);
        int labelLevel = areaCells.isEmpty() ? 0 : areaCells.getFirst().z();
        return new Label(
                label,
                placement.centerQ(),
                placement.centerR(),
                labelLevel,
                ownerId,
                clusterId,
                topologyRef,
                DungeonMapContentModel.ROOM_LABEL_KIND,
                selected,
                preview,
                placement.availableLengthScene(),
                placement.rotationDegrees());
    }

    static Cell cell(
            DungeonEditorMapSnapshot.Area area,
            DungeonCellRef cell,
            boolean selected,
            boolean preview,
            boolean destructive,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return new Cell(
                cell.q() + deltaQ,
                cell.r() + deltaR,
                cell.level() + deltaLevel,
                area.label(),
                areaKind(area),
                area.id(),
                clusterId(area),
                areaTopologyRef(area),
                selected,
                false,
                preview,
                destructive);
    }

    static Cell featureCell(
            DungeonEditorMapSnapshot.Feature feature,
            DungeonCellRef cell,
            boolean selected
    ) {
        return featureCell(feature, cell, selected, false, false);
    }

    static Cell featureCell(
            DungeonEditorMapSnapshot.Feature feature,
            DungeonCellRef cell,
            boolean selected,
            boolean preview,
            boolean destructive
    ) {
        return new Cell(
                cell.q(),
                cell.r(),
                cell.level(),
                feature.label(),
                featureCellKind(feature.kind()),
                feature.id(),
                0L,
                featureTopologyRef(feature),
                selected,
                false,
                preview,
                destructive);
    }

    static Edge edge(
            DungeonEditorMapSnapshot.Boundary boundary,
            int deltaQ,
            int deltaR,
            int deltaLevel,
            boolean preview,
            boolean selected
    ) {
        DungeonEdgeRef edge = boundary.edge();
        return new Edge(
                edge.from().q() + deltaQ,
                edge.from().r() + deltaR,
                edge.to().q() + deltaQ,
                edge.to().r() + deltaR,
                edge.from().level() + deltaLevel,
                boundaryKind(boundary.kind()),
                boundary.label(),
                boundary.id(),
                topologyRef(boundary.topologyRef()),
                selected,
                preview);
    }

    static Marker featureMarker(
            DungeonEditorMapSnapshot.Feature feature,
            CellCenter center,
            int level,
            boolean selected
    ) {
        return featureMarker(feature, center, level, selected, false);
    }

    static Marker featureMarker(
            DungeonEditorMapSnapshot.Feature feature,
            CellCenter center,
            int level,
            boolean selected,
            boolean preview
    ) {
        DungeonEdgeRef anchorEdge = feature.anchorEdge();
        double markerQ = center.q();
        double markerR = center.r();
        if (!invalidEdge(anchorEdge)) {
            markerQ = (anchorEdge.from().q() + anchorEdge.to().q()) / 2.0;
            markerR = (anchorEdge.from().r() + anchorEdge.to().r()) / 2.0;
        }
        return new Marker(
                featureMarkerLabel(feature.kind()),
                markerQ,
                markerR,
                level,
                featureMarkerKind(feature.kind()),
                selected,
                featureMarkerHandle(
                        feature,
                        (int) Math.floor(center.q()),
                        (int) Math.floor(center.r()),
                        level),
                preview,
                invalidEdge(anchorEdge) ? null : anchorEdge,
                feature.label());
    }

    static boolean hasFeatureMarkerPlacement(
            DungeonEditorMapSnapshot.Feature feature,
            List<Cell> featureCells
    ) {
        return featureCells != null && !featureCells.isEmpty()
                || !invalidEdge(feature == null ? null : feature.anchorEdge());
    }

    static CellCenter featureMarkerCenter(
            DungeonEditorMapSnapshot.Feature feature,
            List<Cell> featureCells
    ) {
        DungeonEdgeRef anchorEdge = feature == null ? null : feature.anchorEdge();
        if (!invalidEdge(anchorEdge)) {
            return new CellCenter(
                    (anchorEdge.from().q() + anchorEdge.to().q()) / 2.0,
                    (anchorEdge.from().r() + anchorEdge.to().r()) / 2.0);
        }
        return centerOfCells(featureCells);
    }

    static int featureMarkerLevel(
            DungeonEditorMapSnapshot.Feature feature,
            List<Cell> featureCells
    ) {
        if (featureCells != null && !featureCells.isEmpty()) {
            return featureCells.getFirst().z();
        }
        DungeonEdgeRef anchorEdge = feature == null ? null : feature.anchorEdge();
        return invalidEdge(anchorEdge) ? 0 : anchorEdge.from().level();
    }

    static Marker handleMarker(
            DungeonEditorHandleSnapshot handle,
            DungeonEditorStateSnapshot.Selection selection,
            boolean preview
    ) {
        DungeonEditorHandleRef ref = handle.ref();
        return handleMarker(
                ref,
                handle.cell().q(),
                handle.cell().r(),
                handle.cell().level(),
                handle.markerQ(),
                handle.markerR(),
                selectedHandle(ref, selection),
                preview);
    }

    static Marker handleMarker(
            DungeonEditorHandleRef ref,
            int q,
            int r,
            int level,
            double markerQ,
            double markerR,
            boolean selected,
            boolean preview
    ) {
        double renderMarkerQ = markerQ;
        double renderMarkerR = markerR;
        if (ref.kind().isDoor() && !invalidEdge(ref.sourceEdge())) {
            renderMarkerQ = (ref.sourceEdge().from().q() + ref.sourceEdge().to().q()) / 2.0;
            renderMarkerR = (ref.sourceEdge().from().r() + ref.sourceEdge().to().r()) / 2.0;
        }
        return new Marker(
                handleMarkerLabel(ref.kind()),
                handleMarkerCoordinate(ref.kind(), q, renderMarkerQ),
                handleMarkerCoordinate(ref.kind(), r, renderMarkerR),
                level,
                handleMarkerKind(ref.kind()),
                selected,
                markerHandle(ref, q, r, level),
                preview);
    }

    static Label clusterLabel(
            DungeonEditorHandleSnapshot handle,
            boolean selected,
            boolean preview,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        DungeonCellRef cell = handle.cell();
        DungeonEditorHandleRef ref = handle.ref();
        return new Label(
                handle.label(),
                cell.q() + deltaQ + 0.5,
                cell.r() + deltaR + 0.5,
                cell.level() + deltaLevel,
                ref.ownerId(),
                ref.clusterId(),
                topologyRef(ref.topologyRef()),
                DungeonMapContentModel.CLUSTER_LABEL_KIND,
                selected,
                preview,
                0.0,
                0.0);
    }

    static Label roomLabel(
            DungeonEditorMapSnapshot.Area area,
            List<Cell> areaCells,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel,
            boolean selected,
            boolean preview
    ) {
        return roomLabel(
                area.label(),
                area.id(),
                clusterId(area),
                areaTopologyRef(area),
                areaCells,
                roomLabelPlacementContentPartModel,
                selected,
                preview);
    }

    static MarkerHandle markerHandle(
            int q,
            int r,
            int level
    ) {
        return new MarkerHandle(null, q, r, level, null);
    }

    static MarkerHandle markerHandle(
            TopologyRef topologyRef,
            int q,
            int r,
            int level
    ) {
        return new MarkerHandle(null, q, r, level, topologyRef);
    }

    static MarkerHandle markerHandle(
            DungeonEditorHandleRef handle,
            int q,
            int r,
            int level
    ) {
        return new MarkerHandle(handle, q, r, level, null);
    }

    static MarkerHandle featureMarkerHandle(
            DungeonEditorMapSnapshot.Feature feature,
            int q,
            int r,
            int level
    ) {
        if (STAIR_KIND.equalsIgnoreCase(feature.kind())) {
            return markerHandle(q, r, level);
        }
        TopologyRef topologyRef = featureTopologyRef(feature);
        if (topologyRef.equals(TopologyRef.empty())) {
            return markerHandle(q, r, level);
        }
        return markerHandle(topologyRef, q, r, level);
    }

    static boolean selectedArea(
            DungeonEditorMapSnapshot.Area area,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        if (selection == null) {
            return false;
        }
        if (selection.clusterSelection()) {
            return areaKind(area) == CellKind.ROOM
                    && clusterId(area) == selection.clusterId();
        }
        return areaTopologyRef(area).equals(topologyRef(selection.topologyRef()));
    }

    static boolean selectedAreaSurface(
            DungeonEditorMapSnapshot.Area area,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        return selection != null
                && !selection.clusterSelection()
                && areaTopologyRef(area).equals(topologyRef(selection.topologyRef()));
    }

    static boolean selectedFeature(
            DungeonEditorMapSnapshot.Feature feature,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        return featureTopologyRef(feature).equals(topologyRef(selection.topologyRef()));
    }

    static boolean selectedBoundary(
            DungeonEditorMapSnapshot.Boundary boundary,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        return topologyRef(boundary.topologyRef()).equals(topologyRef(selection.topologyRef()));
    }

    static boolean selectedHandle(
            DungeonEditorHandleRef ref,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        DungeonEditorHandleRef selected = selection.handleRef();
        return selected != null
                && sameHandleRef(ref, selected);
    }

    static boolean selectedClusterLabel(
            DungeonEditorHandleSnapshot handle,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        if (selection.clusterSelection()) {
            return handle.ref().clusterId() > 0L && handle.ref().clusterId() == selection.clusterId();
        }
        return selectedHandle(handle.ref(), selection);
    }

    static CellKind areaKind(DungeonEditorMapSnapshot.Area area) {
        return "CORRIDOR".equalsIgnoreCase(area.kind())
                ? CellKind.CORRIDOR
                : CellKind.ROOM;
    }

    static EdgeKind boundaryKind(String kind) {
        return "DOOR".equalsIgnoreCase(kind)
                ? EdgeKind.DOOR
                : EdgeKind.WALL;
    }

    static CellKind featureCellKind(String kind) {
        return featureCellKind(featureKind(kind));
    }

    static MarkerKind featureMarkerKind(String kind) {
        return featureMarkerKind(featureKind(kind));
    }

    static String featureMarkerLabel(String kind) {
        return featureMarkerLabel(featureKind(kind));
    }

    static TopologyRef areaTopologyRef(
            DungeonEditorMapSnapshot.Area area
    ) {
        return topologyRef(area.topologyRef());
    }

    static TopologyRef featureTopologyRef(
            DungeonEditorMapSnapshot.Feature feature
    ) {
        return topologyRef(feature.topologyRef());
    }

    static long clusterId(DungeonEditorMapSnapshot.Area area) {
        return area.clusterId();
    }

    static boolean sameHandleRef(DungeonEditorHandleRef first, DungeonEditorHandleRef second) {
        return first != null
                && second != null
                && first.kind() == second.kind()
                && topologyRef(first.topologyRef()).equals(topologyRef(second.topologyRef()))
                && first.ownerId() == second.ownerId()
                && first.clusterId() == second.clusterId()
                && first.corridorId() == second.corridorId()
                && first.roomId() == second.roomId()
                && first.index() == second.index();
    }

    static boolean invalidEdge(@Nullable DungeonEdgeRef edge) {
        return edge == null || edge.from() == null || edge.to() == null;
    }

    static CellCenter centerOfCells(List<Cell> cells) {
        double q = 0.0;
        double r = 0.0;
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            q += cell.q() + 0.5;
            r += cell.r() + 0.5;
        }
        int count = Math.max(1, cells == null ? 0 : cells.size());
        return new CellCenter(q / count, r / count);
    }

    static TopologyRef topologyRef(
            DungeonEditorTopologyElementRef ref
    ) {
        return ref == null
                ? TopologyRef.empty()
                : new TopologyRef(ref.kind(), ref.id());
    }

    static TopologyRef topologyRef(DungeonTopologyElementRef ref) {
        return ref == null
                ? TopologyRef.empty()
                : new TopologyRef(ref.kind().name(), ref.id());
    }

    record CellCenter(double q, double r) {
    }

    private static MarkerKind handleMarkerKind(
            DungeonEditorHandleKind kind
    ) {
        if (kind == DungeonEditorHandleKind.DOOR) {
            return MarkerKind.DOOR;
        }
        if (kind == DungeonEditorHandleKind.STAIR_ANCHOR) {
            return MarkerKind.STAIR;
        }
        if (kind == DungeonEditorHandleKind.CLUSTER_WALL_RUN) {
            return MarkerKind.CLUSTER;
        }
        return MarkerKind.WAYPOINT;
    }

    static CellKind featureCellKind(DungeonFeatureKind kind) {
        return switch (kind == null ? DungeonFeatureKind.STAIR : kind) {
            case TRANSITION -> CellKind.TRANSITION;
            case STAIR -> CellKind.STAIR;
            case OBJECT -> CellKind.FEATURE_OBJECT;
            case ENCOUNTER -> CellKind.FEATURE_ENCOUNTER;
            case POI -> CellKind.FEATURE_POI;
        };
    }

    static MarkerKind featureMarkerKind(
            DungeonFeatureKind kind
    ) {
        return switch (kind == null ? DungeonFeatureKind.STAIR : kind) {
            case TRANSITION -> MarkerKind.TRANSITION;
            case STAIR -> MarkerKind.STAIR;
            case OBJECT -> MarkerKind.FEATURE_OBJECT;
            case ENCOUNTER -> MarkerKind.FEATURE_ENCOUNTER;
            case POI -> MarkerKind.FEATURE_POI;
        };
    }

    static String featureMarkerLabel(DungeonFeatureKind kind) {
        return switch (kind == null ? DungeonFeatureKind.STAIR : kind) {
            case TRANSITION -> "";
            case STAIR -> "z";
            case OBJECT -> "O";
            case ENCOUNTER -> "E";
            case POI -> "P";
        };
    }

    private static DungeonFeatureKind featureKind(String kind) {
        if (kind == null || kind.isBlank()) {
            return DungeonFeatureKind.STAIR;
        }
        try {
            return DungeonFeatureKind.valueOf(kind.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return DungeonFeatureKind.STAIR;
        }
    }

    private static double handleMarkerCoordinate(DungeonEditorHandleKind kind, int coordinate, double markerCoordinate) {
        if (kind == DungeonEditorHandleKind.CLUSTER_WALL_RUN || kind == DungeonEditorHandleKind.DOOR) {
            return markerCoordinate;
        }
        return kind == DungeonEditorHandleKind.CLUSTER_CORNER ? coordinate : coordinate + 0.5;
    }

    private static String handleMarkerLabel(DungeonEditorHandleKind kind) {
        if (kind == DungeonEditorHandleKind.CLUSTER_CORNER) {
            return "+";
        }
        if (kind == DungeonEditorHandleKind.CLUSTER_WALL_RUN) {
            return "-";
        }
        if (kind == DungeonEditorHandleKind.DOOR) {
            return "";
        }
        if (kind == DungeonEditorHandleKind.STAIR_ANCHOR) {
            return "z";
        }
        if (kind == DungeonEditorHandleKind.CORRIDOR_ANCHOR) {
            return "o";
        }
        if (kind == DungeonEditorHandleKind.CORRIDOR_WAYPOINT) {
            return "•";
        }
        return "";
    }
}
