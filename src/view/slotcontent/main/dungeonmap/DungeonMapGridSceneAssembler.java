package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.List;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.BoundaryPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.BoundaryTarget;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.GlyphPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.LabelTypography;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.MapCanvasPoint;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.MapCanvasPolygonPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.PaintStyle;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.PointerTarget;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.TextPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapSceneAssembler.SceneBuckets;

final class DungeonMapGridSceneAssembler {

    SceneBuckets assemble(DungeonMapRenderState displayModel, PointerTarget hoverTarget) {
        List<MapCanvasPolygonPrimitive> surfaces = new ArrayList<>();
        List<BoundaryPrimitive> boundaries = new ArrayList<>();
        List<GlyphPrimitive> glyphs = new ArrayList<>();
        List<TextPrimitive> texts = new ArrayList<>();
        List<MapCanvasPolygonPrimitive> actors = new ArrayList<>();
        MainLayers.addCells(displayModel, surfaces, hoverTarget);
        MainLayers.addEdges(displayModel, boundaries, hoverTarget);
        MainLayers.addMarkers(displayModel, glyphs, hoverTarget);
        MainLayers.addLabels(displayModel, texts, hoverTarget);
        ToolHoverOverlay.addToolHoverOverlays(displayModel, hoverTarget, surfaces, boundaries, glyphs);
        MainLayers.addPartyToken(displayModel, actors);
        return new SceneBuckets(
                surfaces,
                boundaries,
                glyphs,
                texts,
                List.of(),
                actors);
    }

    SceneBuckets hoverOverlay(DungeonMapRenderState displayModel, PointerTarget hoverTarget) {
        List<MapCanvasPolygonPrimitive> surfaces = new ArrayList<>();
        List<BoundaryPrimitive> boundaries = new ArrayList<>();
        List<GlyphPrimitive> glyphs = new ArrayList<>();
        List<TextPrimitive> texts = new ArrayList<>();
        if (DungeonMapContentModel.selectableHoverTarget(hoverTarget).syntheticHoverTarget()) {
            ToolHoverOverlay.addToolHoverOverlays(displayModel, hoverTarget, surfaces, boundaries, glyphs);
            return overlayBuckets(surfaces, boundaries, glyphs, texts);
        }
        HoverOverlay.addCellHoverOverlays(displayModel, hoverTarget, surfaces);
        HoverOverlay.addEdgeHoverOverlays(displayModel, hoverTarget, boundaries);
        HoverOverlay.addMarkerHoverOverlays(displayModel, hoverTarget, glyphs, texts);
        HoverOverlay.addLabelHoverOverlays(displayModel, hoverTarget, texts);
        return overlayBuckets(surfaces, boundaries, glyphs, texts);
    }

    private static SceneBuckets overlayBuckets(
            List<MapCanvasPolygonPrimitive> surfaces,
            List<BoundaryPrimitive> boundaries,
            List<GlyphPrimitive> glyphs,
            List<TextPrimitive> texts
    ) {
        return new SceneBuckets(
                surfaces,
                boundaries,
                glyphs,
                texts,
                List.of(),
                List.of());
    }

    private static final class HoverOverlay {

    private static void addCellHoverOverlays(
            DungeonMapRenderState displayModel,
            PointerTarget hoverTarget,
            List<MapCanvasPolygonPrimitive> surfaces
    ) {
        for (DungeonMapRenderState.Cell cell : displayModel.cells()) {
            if (DungeonMapSceneIdentity.includeLevel(displayModel, cell.z())
                    && DungeonMapSceneIdentity.Hover.hoveredCell(hoverTarget, cell)) {
                surfaces.add(new MapCanvasPolygonPrimitive(
                        DungeonMapSceneIdentity.cellHitRef(cell),
                        DungeonMapSceneIdentity.selectionRef(cell.topologyRef()),
                        cell.z(),
                        DungeonMapSceneGeometry.square(cell.q(), cell.r(), 1.0),
                        DungeonMapSceneStyles.Surface.style(cell, displayModel, true)));
            }
        }
    }

    private static void addEdgeHoverOverlays(
            DungeonMapRenderState displayModel,
            PointerTarget hoverTarget,
            List<BoundaryPrimitive> boundaries
    ) {
        for (DungeonMapRenderState.Edge edge : displayModel.edges()) {
            if (DungeonMapSceneIdentity.includeLevel(displayModel, edge.z())
                    && DungeonMapSceneIdentity.Hover.hoveredEdge(hoverTarget, edge)) {
                boundaries.add(new BoundaryPrimitive(
                        DungeonMapSceneIdentity.edgeHitRef(edge),
                        DungeonMapSceneIdentity.selectionRef(edge.topologyRef()),
                        edge.z(),
                        List.of(
                                new MapCanvasPoint(edge.startQ(), edge.startR()),
                                new MapCanvasPoint(edge.endQ(), edge.endR())),
                        DungeonMapSceneStyles.Edge.style(edge, displayModel, true)));
            }
        }
    }

    private static void addMarkerHoverOverlays(
            DungeonMapRenderState displayModel,
            PointerTarget hoverTarget,
            List<GlyphPrimitive> glyphs,
            List<TextPrimitive> texts
    ) {
        for (DungeonMapRenderState.Marker marker : displayModel.markers()) {
            if (DungeonMapSceneIdentity.includeLevel(displayModel, marker.z())
                    && DungeonMapSceneIdentity.Hover.hoveredMarker(hoverTarget, marker)) {
                glyphs.add(new GlyphPrimitive(
                        DungeonMapSceneIdentity.markerHitRef(marker),
                        DungeonMapSceneIdentity.selectionRef(marker.handle().topologyRef()),
                        marker.z(),
                        DungeonMapSceneGeometry.Marker.markerShape(marker),
                        DungeonMapSceneStyles.Marker.style(marker, displayModel, true),
                        DungeonMapSceneGeometry.Marker.markerText(marker),
                        DungeonMapSceneStyles.Palette.LABEL_TEXT));
                addMarkerHoverLabel(marker, texts);
            }
        }
    }

    private static void addLabelHoverOverlays(
            DungeonMapRenderState displayModel,
            PointerTarget hoverTarget,
            List<TextPrimitive> texts
    ) {
        for (DungeonMapRenderState.Label label : displayModel.labels()) {
            if (DungeonMapSceneIdentity.includeLevel(displayModel, label.z())
                    && DungeonMapSceneIdentity.Hover.hoveredLabel(hoverTarget, label)) {
                texts.add(new TextPrimitive(
                        DungeonMapSceneIdentity.labelHitRef(label),
                        DungeonMapSceneIdentity.selectionRef(label.topologyRef()),
                        label.z(),
                        DungeonMapSceneGeometry.Label.renderText(label),
                        label.q(),
                        label.r(),
                        DungeonMapSceneGeometry.Label.labelWidthScene(label),
                        DungeonMapSceneGeometry.Label.labelHeightScene(label),
                        label.rotationDegrees(),
                        DungeonMapSceneGeometry.Label.typography(label),
                        DungeonMapSceneStyles.Label.style(label, displayModel, true),
                        DungeonMapSceneGeometry.Label.textColor(label)));
            }
        }
    }

    private static void addMarkerHoverLabel(
            DungeonMapRenderState.Marker marker,
            List<TextPrimitive> texts
    ) {
        if (marker.hoverLabel().isBlank()) {
            return;
        }
        texts.add(new TextPrimitive(
                "",
                DungeonMapSceneIdentity.selectionRef(marker.handle().topologyRef()),
                marker.z(),
                marker.hoverLabel(),
                marker.q(),
                marker.r() - 0.42,
                DungeonMapSceneGeometry.Label.labelWidthScene(marker.hoverLabel()),
                DungeonMapSceneGeometry.Label.labelHeightScene(),
                0.0,
                LabelTypography.mapLabel(),
                new PaintStyle(null, null, 0.0, 1.0, false),
                DungeonMapSceneStyles.Palette.LABEL_TEXT));
    }

    }

    private static final class MainLayers {

    private static void addCells(
            DungeonMapRenderState displayModel,
            List<MapCanvasPolygonPrimitive> surfaces,
            PointerTarget hoverTarget
    ) {
        for (DungeonMapRenderState.Cell cell : displayModel.cells()) {
            if (!DungeonMapSceneIdentity.includeLevel(displayModel, cell.z())) {
                continue;
            }
            surfaces.add(new MapCanvasPolygonPrimitive(
                    DungeonMapSceneIdentity.cellHitRef(cell),
                    DungeonMapSceneIdentity.selectionRef(cell.topologyRef()),
                    cell.z(),
                    DungeonMapSceneGeometry.square(cell.q(), cell.r(), 1.0),
                    DungeonMapSceneStyles.Surface.style(
                            cell,
                            displayModel,
                            DungeonMapSceneIdentity.Hover.hoveredCell(hoverTarget, cell))));
        }
    }

    private static void addEdges(
            DungeonMapRenderState displayModel,
            List<BoundaryPrimitive> boundaries,
            PointerTarget hoverTarget
    ) {
        for (DungeonMapRenderState.Edge edge : displayModel.edges()) {
            if (!DungeonMapSceneIdentity.includeLevel(displayModel, edge.z())) {
                continue;
            }
            boundaries.add(new BoundaryPrimitive(
                    DungeonMapSceneIdentity.edgeHitRef(edge),
                    DungeonMapSceneIdentity.selectionRef(edge.topologyRef()),
                    edge.z(),
                    List.of(
                            new MapCanvasPoint(edge.startQ(), edge.startR()),
                            new MapCanvasPoint(edge.endQ(), edge.endR())),
                    DungeonMapSceneStyles.Edge.style(
                            edge,
                            displayModel,
                            DungeonMapSceneIdentity.Hover.hoveredEdge(hoverTarget, edge))));
        }
    }

    private static void addMarkers(
            DungeonMapRenderState displayModel,
            List<GlyphPrimitive> glyphs,
            PointerTarget hoverTarget
    ) {
        for (DungeonMapRenderState.Marker marker : displayModel.markers()) {
            if (!DungeonMapSceneIdentity.includeLevel(displayModel, marker.z())) {
                continue;
            }
            String hitRef = DungeonMapSceneIdentity.markerHitRef(marker);
            glyphs.add(new GlyphPrimitive(
                    hitRef,
                    DungeonMapSceneIdentity.selectionRef(marker.handle().topologyRef()),
                    marker.z(),
                    DungeonMapSceneGeometry.Marker.markerShape(marker),
                    DungeonMapSceneStyles.Marker.style(
                            marker,
                            displayModel,
                            DungeonMapSceneIdentity.Hover.hoveredMarker(hoverTarget, marker)),
                    DungeonMapSceneGeometry.Marker.markerText(marker),
                    DungeonMapSceneStyles.Palette.LABEL_TEXT));
        }
    }

    private static void addLabels(
            DungeonMapRenderState displayModel,
            List<TextPrimitive> texts,
            PointerTarget hoverTarget
    ) {
        for (DungeonMapRenderState.Label label : displayModel.labels()) {
            if (!DungeonMapSceneIdentity.includeLevel(displayModel, label.z())) {
                continue;
            }
            texts.add(new TextPrimitive(
                    DungeonMapSceneIdentity.labelHitRef(label),
                    DungeonMapSceneIdentity.selectionRef(label.topologyRef()),
                    label.z(),
                    DungeonMapSceneGeometry.Label.renderText(label),
                    label.q(),
                    label.r(),
                    DungeonMapSceneGeometry.Label.labelWidthScene(label),
                    DungeonMapSceneGeometry.Label.labelHeightScene(label),
                    label.rotationDegrees(),
                    DungeonMapSceneGeometry.Label.typography(label),
                    DungeonMapSceneStyles.Label.style(
                            label,
                            displayModel,
                            DungeonMapSceneIdentity.Hover.hoveredLabel(hoverTarget, label)),
                    DungeonMapSceneGeometry.Label.textColor(label)));
        }
    }

    private static void addPartyToken(
            DungeonMapRenderState displayModel,
            List<MapCanvasPolygonPrimitive> actors
    ) {
        DungeonMapRenderState.PartyToken token = displayModel.partyToken();
        if (token == null || !token.visible() || !DungeonMapSceneIdentity.includeLevel(displayModel, token.z())) {
            return;
        }
        actors.add(new MapCanvasPolygonPrimitive(
                "",
                null,
                token.z(),
                DungeonMapSceneGeometry.Marker.partyTokenShape(token),
                new PaintStyle(
                        DungeonMapSceneStyles.Palette.PARTY_FILL,
                        DungeonMapSceneStyles.Palette.PARTY_STROKE,
                        1.8 / 32.0,
                        1.0,
                        false)));
    }

    }

    private static final class ToolHoverOverlay {

    private static void addToolHoverOverlays(
            DungeonMapRenderState displayModel,
            PointerTarget hoverTarget,
            List<MapCanvasPolygonPrimitive> surfaces,
            List<BoundaryPrimitive> boundaries,
            List<GlyphPrimitive> glyphs
    ) {
        PointerTarget safeTarget = DungeonMapContentModel.selectableHoverTarget(hoverTarget);
        if (!safeTarget.syntheticHoverTarget()) {
            return;
        }
        if (safeTarget.isCellTarget()) {
            addSyntheticCellHover(displayModel, safeTarget, surfaces);
            return;
        }
        if (safeTarget.isBoundaryTarget()) {
            addSyntheticBoundaryHover(displayModel, safeTarget, boundaries);
            return;
        }
        if (safeTarget.isVertexTarget()) {
            addSyntheticVertexHover(displayModel, safeTarget, glyphs);
        }
    }

    private static void addSyntheticCellHover(
            DungeonMapRenderState displayModel,
            PointerTarget hoverTarget,
            List<MapCanvasPolygonPrimitive> surfaces
    ) {
        DungeonMapContentModel.CellTarget cell = hoverTarget.cellRef();
        if (!cell.exact() || !DungeonMapSceneIdentity.includeLevel(displayModel, cell.level())) {
            return;
        }
        surfaces.add(new MapCanvasPolygonPrimitive(
                "",
                "",
                cell.level(),
                DungeonMapSceneGeometry.square(cell.q(), cell.r(), 1.0),
                DungeonMapSceneStyles.HoverOverlay.cell()));
    }

    private static void addSyntheticBoundaryHover(
            DungeonMapRenderState displayModel,
            PointerTarget hoverTarget,
            List<BoundaryPrimitive> boundaries
    ) {
        BoundaryTarget boundary = hoverTarget.boundaryRef();
        if (!boundary.key().startsWith("hover-boundary:")
                || !DungeonMapSceneIdentity.includeLevel(displayModel, boundary.startLevel())) {
            return;
        }
        boundaries.add(new BoundaryPrimitive(
                "",
                "",
                boundary.startLevel(),
                List.of(
                        new MapCanvasPoint(boundary.startQ(), boundary.startR()),
                        new MapCanvasPoint(boundary.endQ(), boundary.endR())),
                DungeonMapSceneStyles.HoverOverlay.boundary()));
    }

    private static void addSyntheticVertexHover(
            DungeonMapRenderState displayModel,
            PointerTarget hoverTarget,
            List<GlyphPrimitive> glyphs
    ) {
        DungeonMapContentModel.VertexTarget vertex = hoverTarget.vertexRef();
        if (!vertex.exact() || !DungeonMapSceneIdentity.includeLevel(displayModel, vertex.level())) {
            return;
        }
        glyphs.add(new GlyphPrimitive(
                "",
                "",
                vertex.level(),
                DungeonMapSceneGeometry.Marker.circle(vertex.q(), vertex.r(), 0.14, 16),
                DungeonMapSceneStyles.HoverOverlay.vertex(),
                "",
                DungeonMapSceneStyles.Palette.LABEL_TEXT));
    }
    }
}
