package features.dungeon.adapter.javafx.map;

import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.DungeonEditorHandleRef;
import features.dungeon.api.DungeonEditorHandleSnapshot;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonEditorStateSnapshot;

final class DungeonMapRenderMarkers {

    private DungeonMapRenderMarkers() {
    }

    static DungeonMapRenderState.Marker featureMarker(
            DungeonEditorMapSnapshot.Feature feature,
            DungeonMapRenderElementFactory.RenderCellCenter center,
            int level,
            boolean selected
    ) {
        return featureMarker(feature, center, level, selected, false);
    }

    static DungeonMapRenderState.Marker featureMarker(
            DungeonEditorMapSnapshot.Feature feature,
            DungeonMapRenderElementFactory.RenderCellCenter center,
            int level,
            boolean selected,
            boolean preview
    ) {
        DungeonEdgeRef anchorEdge = DungeonMapRenderMarkerPlacement.validAnchorEdge(feature.anchorEdge());
        DungeonMapRenderElementFactory.RenderCellCenter markerPoint =
                DungeonMapRenderMarkerPlacement.featureMarkerPoint(anchorEdge, center);
        return new DungeonMapRenderState.Marker(
                DungeonMapRenderMarkerKinds.featureMarkerLabel(feature.kind()),
                markerPoint.q(),
                markerPoint.r(),
                level,
                DungeonMapRenderMarkerKinds.featureMarkerKind(feature.kind()),
                selected,
                DungeonMapRenderMarkerHandles.featureMarkerHandle(
                        feature,
                        (int) Math.floor(center.q()),
                        (int) Math.floor(center.r()),
                        level),
                preview,
                anchorEdge,
                feature.label());
    }

    static DungeonMapRenderState.Marker handleMarker(
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
                DungeonMapRenderSelection.selectedHandle(ref, selection),
                preview);
    }

    static DungeonMapRenderState.Marker handleMarker(
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
        if (ref.kind().isDoor() && !DungeonMapRenderElementFactory.invalidEdge(ref.sourceEdge())) {
            renderMarkerQ = (ref.sourceEdge().from().q() + ref.sourceEdge().to().q()) / 2.0;
            renderMarkerR = (ref.sourceEdge().from().r() + ref.sourceEdge().to().r()) / 2.0;
        }
        return new DungeonMapRenderState.Marker(
                DungeonMapRenderMarkerKinds.handleMarkerLabel(ref.kind()),
                DungeonMapRenderMarkerKinds.handleMarkerCoordinate(ref.kind(), q, renderMarkerQ),
                DungeonMapRenderMarkerKinds.handleMarkerCoordinate(ref.kind(), r, renderMarkerR),
                level,
                DungeonMapRenderMarkerKinds.handleMarkerKind(ref.kind()),
                selected,
                DungeonMapRenderMarkerHandles.markerHandle(ref, q, r, level),
                preview);
    }

    static DungeonMapRenderState.Label clusterLabel(
            DungeonEditorHandleSnapshot handle,
            boolean selected,
            boolean preview,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        DungeonCellRef cell = handle.cell();
        DungeonEditorHandleRef ref = handle.ref();
        return new DungeonMapRenderState.Label(
                handle.label(),
                cell.q() + deltaQ + 0.5,
                cell.r() + deltaR + 0.5,
                cell.level() + deltaLevel,
                ref.ownerId(),
                ref.clusterId(),
                DungeonMapRenderElementFactory.topologyRef(ref.topologyRef()),
                PreparedLabelKind.CLUSTER_LABEL,
                selected,
                preview,
                0.0,
                0.0);
    }
}
