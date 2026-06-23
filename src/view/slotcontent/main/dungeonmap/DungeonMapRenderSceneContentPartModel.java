package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorMapHitRef;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.BoundaryPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.DungeonMapRenderState;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.GlyphPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.LabelTypography;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.MapCanvasPoint;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.MapCanvasPolygonPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.PaintStyle;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.PointerTarget;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.PointerTargetKind;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.RelationPrimitive;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.RenderColor;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.RenderScene;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.TextPrimitive;

final class DungeonMapRenderSceneContentPartModel {

    private final GridSceneAssembler gridSceneAssembler = new GridSceneAssembler();
    private final GraphSceneAssembler graphSceneAssembler = new GraphSceneAssembler();

    RenderSceneProjection toSceneProjection(DungeonMapRenderState displayModel, PointerTarget hoverTarget) {
        if (displayModel == null) {
            return new RenderSceneProjection(
                    RenderScene.empty(DungeonMapContentModel.defaultTitle()),
                    SceneBuckets.empty());
        }
        SceneBuckets buckets = displayModel.isGraphView()
                ? graphSceneAssembler.assemble(displayModel, hoverTarget)
                : gridSceneAssembler.assemble(displayModel, hoverTarget);
        return new RenderSceneProjection(
                new RenderScene(
                        displayModel.title(),
                        displayModel.subtitle(),
                        displayModel.modeLabel(),
                        displayModel.statusLabel(),
                        displayModel.summaryLabel(),
                        displayModel.mapLoaded(),
                        displayModel.overlayMessage(),
                        !displayModel.isGraphView(),
                        buckets.surfaces(),
                        buckets.boundaries(),
                        buckets.glyphs(),
                        buckets.texts(),
                        buckets.relations(),
                        buckets.actors()),
                buckets);
    }

    record RenderSceneProjection(
            RenderScene renderScene,
            SceneBuckets buckets
    ) {
    }

    record SceneBuckets(
            List<MapCanvasPolygonPrimitive> surfaces,
            List<BoundaryPrimitive> boundaries,
            List<GlyphPrimitive> glyphs,
            List<TextPrimitive> texts,
            List<RelationPrimitive> relations,
            List<MapCanvasPolygonPrimitive> actors
    ) {
        private static SceneBuckets empty() {
            return new SceneBuckets(
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of());
        }
    }

    private static final class GridSceneAssembler {

        private SceneBuckets assemble(DungeonMapRenderState displayModel, PointerTarget hoverTarget) {
            List<MapCanvasPolygonPrimitive> surfaces = new ArrayList<>();
            List<BoundaryPrimitive> boundaries = new ArrayList<>();
            List<GlyphPrimitive> glyphs = new ArrayList<>();
            List<TextPrimitive> texts = new ArrayList<>();
            List<MapCanvasPolygonPrimitive> actors = new ArrayList<>();
            addCells(displayModel, surfaces, hoverTarget);
            addEdges(displayModel, boundaries, hoverTarget);
            addMarkers(displayModel, glyphs, hoverTarget);
            addLabels(displayModel, texts, hoverTarget);
            addPartyToken(displayModel, actors);
            return new SceneBuckets(
                    surfaces,
                    boundaries,
                    glyphs,
                    texts,
                    List.of(),
                    actors);
        }

        private void addCells(
                DungeonMapRenderState displayModel,
                List<MapCanvasPolygonPrimitive> surfaces,
                PointerTarget hoverTarget
        ) {
            for (DungeonMapRenderState.Cell cell : displayModel.cells()) {
                if (!LevelFilter.includeLevel(displayModel, cell.z())) {
                    continue;
                }
                surfaces.add(new MapCanvasPolygonPrimitive(
                        SceneIdentity.cellHitRef(cell),
                        SceneIdentity.selectionRef(cell.topologyRef()),
                        cell.z(),
                        SceneGeometry.square(cell.q(), cell.r(), 1.0),
                        SurfaceStyler.style(cell, displayModel, HoverFacts.hoveredCell(hoverTarget, cell))));
            }
        }

        private void addEdges(
                DungeonMapRenderState displayModel,
                List<BoundaryPrimitive> boundaries,
                PointerTarget hoverTarget
        ) {
            for (DungeonMapRenderState.Edge edge : displayModel.edges()) {
                if (!LevelFilter.includeLevel(displayModel, edge.z())) {
                    continue;
                }
                boundaries.add(new BoundaryPrimitive(
                        SceneIdentity.edgeHitRef(edge),
                        SceneIdentity.selectionRef(edge.topologyRef()),
                        edge.z(),
                        List.of(
                                new MapCanvasPoint(edge.startQ(), edge.startR()),
                                new MapCanvasPoint(edge.endQ(), edge.endR())),
                        EdgeStyler.style(edge, displayModel, HoverFacts.hoveredEdge(hoverTarget, edge))));
            }
        }

        private void addMarkers(
                DungeonMapRenderState displayModel,
                List<GlyphPrimitive> glyphs,
                PointerTarget hoverTarget
        ) {
            for (DungeonMapRenderState.Marker marker : displayModel.markers()) {
                if (!LevelFilter.includeLevel(displayModel, marker.z())) {
                    continue;
                }
                String hitRef = SceneIdentity.markerHitRef(marker);
                glyphs.add(new GlyphPrimitive(
                        hitRef,
                        SceneIdentity.selectionRef(marker.handle().topologyRef()),
                        marker.z(),
                        SceneGeometry.Marker.markerShape(marker),
                        MarkerStyler.style(marker, displayModel, HoverFacts.hoveredMarker(hoverTarget, marker)),
                        SceneGeometry.Marker.markerText(marker),
                        ScenePalette.LABEL_TEXT));
            }
        }

        private void addLabels(
                DungeonMapRenderState displayModel,
                List<TextPrimitive> texts,
                PointerTarget hoverTarget
        ) {
            for (DungeonMapRenderState.Label label : displayModel.labels()) {
                if (!LevelFilter.includeLevel(displayModel, label.z())) {
                    continue;
                }
                texts.add(new TextPrimitive(
                        SceneIdentity.labelHitRef(label),
                        SceneIdentity.selectionRef(label.topologyRef()),
                        label.z(),
                        SceneGeometry.Label.renderText(label),
                        label.q(),
                        label.r(),
                        SceneGeometry.Label.labelWidthScene(label),
                        SceneGeometry.Label.labelHeightScene(label),
                        label.rotationDegrees(),
                        SceneGeometry.Label.typography(label),
                        LabelStyler.style(label, displayModel, HoverFacts.hoveredLabel(hoverTarget, label)),
                        SceneGeometry.Label.textColor(label)));
            }
        }

        private void addPartyToken(
                DungeonMapRenderState displayModel,
                List<MapCanvasPolygonPrimitive> actors
        ) {
            DungeonMapRenderState.PartyToken token = displayModel.partyToken();
            if (token == null || !token.visible() || !LevelFilter.includeLevel(displayModel, token.z())) {
                return;
            }
            actors.add(new MapCanvasPolygonPrimitive(
                    "",
                    null,
                    token.z(),
                    SceneGeometry.Marker.partyTokenShape(token),
                    new PaintStyle(
                            ScenePalette.PARTY_FILL,
                            ScenePalette.PARTY_STROKE,
                            1.8 / 32.0,
                            1.0,
                            false)));
        }
    }

    private static final class GraphSceneAssembler {

        private SceneBuckets assemble(DungeonMapRenderState displayModel, PointerTarget hoverTarget) {
            List<MapCanvasPolygonPrimitive> surfaces = new ArrayList<>();
            List<TextPrimitive> texts = new ArrayList<>();
            List<RelationPrimitive> relations = new ArrayList<>();
            Map<Long, DungeonMapRenderState.GraphNode> nodesById = indexNodes(displayModel.graphNodes());
            addLinks(displayModel, relations, nodesById);
            addNodes(displayModel, surfaces, texts, hoverTarget);
            return new SceneBuckets(
                    surfaces,
                    List.of(),
                    List.of(),
                    texts,
                    relations,
                    List.of());
        }

        private Map<Long, DungeonMapRenderState.GraphNode> indexNodes(List<DungeonMapRenderState.GraphNode> graphNodes) {
            Map<Long, DungeonMapRenderState.GraphNode> nodesById = new LinkedHashMap<>();
            for (DungeonMapRenderState.GraphNode node : graphNodes) {
                nodesById.put(node.id(), node);
            }
            return nodesById;
        }

        private void addLinks(
                DungeonMapRenderState displayModel,
                List<RelationPrimitive> relations,
                Map<Long, DungeonMapRenderState.GraphNode> nodesById
        ) {
            for (DungeonMapRenderState.GraphLink link : displayModel.graphLinks()) {
                DungeonMapRenderState.GraphNode from = nodesById.get(link.fromId());
                DungeonMapRenderState.GraphNode to = nodesById.get(link.toId());
                if (from == null || to == null) {
                    continue;
                }
                relations.add(new RelationPrimitive(
                        "",
                        displayModel.projectionLevel(),
                        List.of(
                                new MapCanvasPoint(from.q(), from.r()),
                                new MapCanvasPoint(to.q(), to.r())),
                        new PaintStyle(
                                null,
                                link.selected() ? ScenePalette.HIGHLIGHT_STROKE : ScenePalette.GRAPH_LINK,
                                link.selected() ? 2.4 / 32.0 : 1.7 / 32.0,
                                1.0,
                                false)));
            }
        }

        private void addNodes(
                DungeonMapRenderState displayModel,
                List<MapCanvasPolygonPrimitive> surfaces,
                List<TextPrimitive> texts,
                PointerTarget hoverTarget
        ) {
            for (DungeonMapRenderState.GraphNode node : displayModel.graphNodes()) {
                boolean hovered = HoverFacts.hoveredGraphNode(hoverTarget, node);
                surfaces.add(new MapCanvasPolygonPrimitive(
                        SceneIdentity.graphNodeHitRef(node),
                        "ROOM:" + node.id(),
                        displayModel.projectionLevel(),
                        SceneGeometry.roundedRect(node.q(), node.r(), 1.8, 1.1),
                        new PaintStyle(
                                ScenePalette.GRAPH_NODE_FILL,
                                node.selected()
                                        ? ScenePalette.HIGHLIGHT_STROKE
                                        : hovered ? ScenePalette.HOVER_STROKE : ScenePalette.ROOM_CELL_STROKE,
                                node.selected() ? 2.4 / 32.0 : hovered ? 2.0 / 32.0 : 1.2 / 32.0,
                                1.0,
                                false)));
                texts.add(new TextPrimitive(
                        SceneIdentity.graphNodeHitRef(node),
                        "ROOM:" + node.id(),
                        displayModel.projectionLevel(),
                        node.label(),
                        node.q(),
                        node.r(),
                        Math.max(1.8, SceneGeometry.Label.labelWidthScene(node.label())),
                        SceneGeometry.Label.labelHeightScene(),
                        0.0,
                        LabelTypography.mapLabel(),
                        new PaintStyle(null, null, 0.0, 1.0, false),
                        ScenePalette.LABEL_TEXT));
            }
        }
    }

    // Hit, geometry, and style helpers

    private static final class HoverFacts {

        private static boolean hoveredCell(PointerTarget target, DungeonMapRenderState.Cell cell) {
            DungeonMapContentModel.PointerTarget safeTarget = DungeonMapContentModel.selectableHoverTarget(target);
            return safeTarget.targetKind() == PointerTargetKind.CELL
                    && sameTopologyRef(safeTarget.topologyRef(), cell.topologyRef())
                    && safeTarget.ownerId() == cell.ownerId()
                    && safeTarget.clusterId() == cell.clusterId()
                    && safeTarget.elementKind().equals(pointerElementKind(cell.kind()));
        }

        private static boolean hoveredEdge(PointerTarget target, DungeonMapRenderState.Edge edge) {
            DungeonMapContentModel.PointerTarget safeTarget = DungeonMapContentModel.selectableHoverTarget(target);
            return safeTarget.targetKind() == PointerTargetKind.BOUNDARY
                    && safeTarget.ownerId() == edge.ownerId()
                    && sameTopologyRef(safeTarget.topologyRef(), edge.topologyRef());
        }

        private static boolean hoveredMarker(PointerTarget target, DungeonMapRenderState.Marker marker) {
            DungeonMapContentModel.PointerTarget safeTarget = DungeonMapContentModel.selectableHoverTarget(target);
            return safeTarget.targetKind() == PointerTargetKind.HANDLE
                    && safeTarget.handleRef().equals(marker.handle().ref());
        }

        private static boolean hoveredLabel(PointerTarget target, DungeonMapRenderState.Label label) {
            DungeonMapContentModel.PointerTarget safeTarget = DungeonMapContentModel.selectableHoverTarget(target);
            return safeTarget.targetKind() == PointerTargetKind.LABEL
                    && !DungeonMapContentModel.ROOM_LABEL_KIND.equals(label.labelKind())
                    && safeTarget.labelKind().equals(label.labelKind())
                    && sameTopologyRef(safeTarget.topologyRef(), label.topologyRef())
                    && safeTarget.ownerId() == label.ownerId()
                    && safeTarget.clusterId() == label.clusterId();
        }

        private static boolean hoveredGraphNode(PointerTarget target, DungeonMapRenderState.GraphNode node) {
            DungeonMapContentModel.PointerTarget safeTarget = DungeonMapContentModel.selectableHoverTarget(target);
            return safeTarget.targetKind() == PointerTargetKind.GRAPH_NODE
                    && "ROOM".equals(safeTarget.topologyKind())
                    && safeTarget.topologyId() == node.id()
                    && safeTarget.ownerId() == node.id()
                    && safeTarget.clusterId() == node.clusterId();
        }

        private static boolean sameTopologyRef(
                DungeonMapRenderState.TopologyRef first,
                DungeonMapRenderState.TopologyRef second
        ) {
            return Objects.equals(first, second);
        }
    }


    static final class LevelFilter {

        private LevelFilter() {
        }

        static boolean includeLevel(DungeonMapRenderState displayModel, int level) {
            if (level == displayModel.projectionLevel()) {
                return true;
            }
            DungeonMapRenderState.LevelOverlaySettings settings = displayModel.overlaySettings();
            return switch (settings.mode()) {
                case OFF -> false;
                case NEARBY -> Math.abs(level - displayModel.projectionLevel()) <= settings.levelRange();
                case SELECTED -> settings.selectsLevel(level);
            };
        }
    }

    static final class SceneIdentity {

        private SceneIdentity() {
        }

        static @Nullable String selectionRef(DungeonMapRenderState.TopologyRef topologyRef) {
            if (topologyRef == null || topologyRef.isEmpty()) {
                return null;
            }
            return topologyRef.kind() + ":" + topologyRef.id();
        }

        private static String cellHitRef(DungeonMapRenderState.Cell cell) {
            if (cell.preview()) {
                return "";
            }
            return DungeonEditorMapHitRef.cell(
                            cell.kind().name(),
                            cell.ownerId(),
                            cell.clusterId(),
                            cell.topologyRef().kind(),
                            cell.topologyRef().id())
                    .value();
        }

        private static String edgeHitRef(DungeonMapRenderState.Edge edge) {
            if (edge.preview()) {
                return "";
            }
            return DungeonEditorMapHitRef.edge(
                            edge.kind().name(),
                            edge.ownerId(),
                            edge.topologyRef().kind(),
                            edge.topologyRef().id(),
                            edge.z(),
                            edge.startQ(),
                            edge.startR(),
                            edge.endQ(),
                            edge.endR())
                    .value();
        }

        private static String labelHitRef(DungeonMapRenderState.Label label) {
            if (label.preview() || DungeonMapContentModel.ROOM_LABEL_KIND.equals(label.labelKind())) {
                return "";
            }
            return DungeonEditorMapHitRef.label(
                            label.ownerId(),
                            label.clusterId(),
                            label.topologyRef().kind(),
                            label.topologyRef().id(),
                            label.labelKind())
                    .value();
        }

        static String markerHitRef(DungeonMapRenderState.Marker marker) {
            if (marker.preview()) {
                return "";
            }
            DungeonMapRenderState.MarkerHandle handle = marker.handle();
            if (handle.kind() == null) {
                return "";
            }
            return DungeonEditorMapHitRef.marker(
                            handle.ref(),
                            handle.q(),
                            handle.r(),
                            handle.level())
                    .value();
        }

        private static String graphNodeHitRef(DungeonMapRenderState.GraphNode node) {
            return DungeonEditorMapHitRef.graphNode(node.id(), node.clusterId()).value();
        }

    }

    private static String pointerElementKind(DungeonMapRenderState.CellKind kind) {
        return switch (kind) {
            case FEATURE_POI, FEATURE_OBJECT, FEATURE_ENCOUNTER -> "FEATURE_MARKER";
            default -> kind.name();
        };
    }

    static final class SceneGeometry {
        private static final double ROTATION_EPSILON = 0.000_001;

        private SceneGeometry() {
        }

        private static List<MapCanvasPoint> square(double q, double r, double size) {
            return List.of(
                    new MapCanvasPoint(q, r),
                    new MapCanvasPoint(q + size, r),
                    new MapCanvasPoint(q + size, r + size),
                    new MapCanvasPoint(q, r + size));
        }

        private static List<MapCanvasPoint> roundedRect(
                double centerQ,
                double centerR,
                double width,
                double height
        ) {
            double halfWidth = width / 2.0;
            double halfHeight = height / 2.0;
            return List.of(
                    new MapCanvasPoint(centerQ - halfWidth, centerR - halfHeight),
                    new MapCanvasPoint(centerQ + halfWidth, centerR - halfHeight),
                    new MapCanvasPoint(centerQ + halfWidth, centerR + halfHeight),
                    new MapCanvasPoint(centerQ - halfWidth, centerR + halfHeight));
        }

        private static List<MapCanvasPoint> centeredRect(
                double centerQ,
                double centerR,
                double width,
                double height
        ) {
            return roundedRect(centerQ, centerR, width, height);
        }

        static List<MapCanvasPoint> rotatedCenteredRect(
                double centerQ,
                double centerR,
                double width,
                double height,
                double rotationDegrees
        ) {
            List<MapCanvasPoint> points = centeredRect(centerQ, centerR, width, height);
            if (Math.abs(rotationDegrees) < ROTATION_EPSILON) {
                return points;
            }
            double radians = Math.toRadians(rotationDegrees);
            double sin = Math.sin(radians);
            double cos = Math.cos(radians);
            List<MapCanvasPoint> rotated = new ArrayList<>(points.size());
            for (MapCanvasPoint point : points) {
                double deltaQ = point.x() - centerQ;
                double deltaR = point.y() - centerR;
                rotated.add(new MapCanvasPoint(
                        centerQ + deltaQ * cos - deltaR * sin,
                        centerR + deltaQ * sin + deltaR * cos));
            }
            return List.copyOf(rotated);
        }

        static final class Label {
            private static final double ROOM_LABEL_MIN_WIDTH_SCENE = 48.0 / 32.0;
            private static final double ROOM_LABEL_MAX_HEIGHT_SCENE = 1.05;
            private static final double ROOM_LABEL_FONT_MIN_PIXELS = 12.0;
            private static final double ROOM_LABEL_FONT_MAX_PIXELS = 28.0;
            private static final double ROOM_LABEL_WIDTH_TO_FONT_RATIO = 1.55;

            private Label() {
            }

            private static double labelHeightScene() {
                return 24.0 / 32.0;
            }

            static double labelHeightScene(DungeonMapRenderState.Label label) {
                if (label == null || !DungeonMapContentModel.ROOM_LABEL_KIND.equals(label.labelKind())) {
                    return labelHeightScene();
                }
                double fontSceneHeight = typography(label).fontSizePixels()
                        / DungeonMapViewportContentPartModel.baseGrid();
                return Math.max(labelHeightScene(), Math.min(ROOM_LABEL_MAX_HEIGHT_SCENE, fontSceneHeight * 1.35));
            }

            private static double labelWidthScene(String label) {
                return Math.max(
                        56.0 / 32.0,
                        Math.min(180.0 / 32.0, label.length() * labelCharWidthScene() + labelPaddingScene()));
            }

            static double labelWidthScene(DungeonMapRenderState.Label label) {
                if (label != null
                        && DungeonMapContentModel.ROOM_LABEL_KIND.equals(label.labelKind())
                        && label.availableWidthScene() > 0.0) {
                    return Math.max(ROOM_LABEL_MIN_WIDTH_SCENE, label.availableWidthScene());
                }
                return labelWidthScene(renderText(label));
            }

            private static LabelTypography typography(DungeonMapRenderState.Label label) {
                if (label == null || !DungeonMapContentModel.ROOM_LABEL_KIND.equals(label.labelKind())) {
                    return LabelTypography.mapLabel();
                }
                int glyphCount = Math.max(1, renderText(label).length());
                double availablePixels = labelWidthScene(label) * DungeonMapViewportContentPartModel.baseGrid();
                double fontSize = Math.max(
                        ROOM_LABEL_FONT_MIN_PIXELS,
                        Math.min(
                                ROOM_LABEL_FONT_MAX_PIXELS,
                                availablePixels / glyphCount * ROOM_LABEL_WIDTH_TO_FONT_RATIO));
                return LabelTypography.roomLabel(fontSize);
            }

            private static RenderColor textColor(DungeonMapRenderState.Label label) {
                if (label != null && DungeonMapContentModel.ROOM_LABEL_KIND.equals(label.labelKind())) {
                    return label.preview()
                            ? ScenePalette.PREVIEW_ROOM_LABEL_TEXT
                            : label.selected()
                            ? ScenePalette.SELECTED_ROOM_LABEL_TEXT
                            : ScenePalette.ROOM_LABEL_TEXT;
                }
                return ScenePalette.LABEL_TEXT;
            }

            private static String renderText(DungeonMapRenderState.Label label) {
                if (label == null) {
                    return "";
                }
                if (DungeonMapContentModel.ROOM_LABEL_KIND.equals(label.labelKind())) {
                    return label.label().toUpperCase(Locale.ROOT);
                }
                return label.label();
            }

            private static String abbreviateLabel(String label, int maxLength) {
                if (label == null || label.length() <= maxLength) {
                    return label == null ? "" : label;
                }
                return label.substring(0, Math.max(1, maxLength - 1)) + ".";
            }

            private static double labelPaddingScene() {
                return 16.0 / 32.0;
            }

            private static double labelCharWidthScene() {
                return 7.2 / 32.0;
            }
        }

        static final class Marker {

            private Marker() {
            }

            private static List<MapCanvasPoint> markerShape(DungeonMapRenderState.Marker marker) {
                if (marker.isClusterCornerMarker()) {
                    return circle(marker.q(), marker.r(), 0.16, 16);
                }
                if (marker.isWallRunMarker() || marker.isDoorMarker()) {
                    return handlePill(marker);
                }
                double half = markerHalfSizeScene(marker);
                return square(marker.q() - half, marker.r() - half, half * 2.0);
            }

            static List<MapCanvasPoint> doorHandleHitShape(DungeonMapRenderState.Marker marker) {
                boolean horizontal = horizontalMarker(marker);
                double halfLength = 0.22;
                double halfThickness = 0.18;
                return horizontal
                        ? horizontalPill(marker.q(), marker.r(), halfLength, halfThickness)
                        : verticalPill(marker.q(), marker.r(), halfLength, halfThickness);
            }

            private static String markerText(DungeonMapRenderState.Marker marker) {
                if (marker.isClusterCornerMarker() || marker.isWallRunMarker() || marker.isDoorMarker()) {
                    return "";
                }
                return SceneGeometry.Label.abbreviateLabel(marker.label(), marker.isDoorMarker() ? 1 : 3);
            }

            private static List<MapCanvasPoint> handlePill(DungeonMapRenderState.Marker marker) {
                boolean horizontal = horizontalMarker(marker);
                double halfLength = marker.isDoorMarker() ? 0.22 : 0.24;
                double halfThickness = marker.isDoorMarker() ? 0.09 : 0.08;
                return horizontal
                        ? horizontalPill(marker.q(), marker.r(), halfLength, halfThickness)
                        : verticalPill(marker.q(), marker.r(), halfLength, halfThickness);
            }

            private static boolean horizontalMarker(DungeonMapRenderState.Marker marker) {
                DungeonEdgeRef sourceEdge = marker.handle().sourceEdge();
                if (sourceEdge != null) {
                    return sourceEdge.from().r() == sourceEdge.to().r();
                }
                return !"EAST".equals(marker.handle().direction())
                        && !"WEST".equals(marker.handle().direction());
            }

            private static List<MapCanvasPoint> horizontalPill(
                    double centerQ,
                    double centerR,
                    double halfLength,
                    double halfThickness
            ) {
                return List.of(
                        new MapCanvasPoint(centerQ - halfLength, centerR - halfThickness),
                        new MapCanvasPoint(centerQ + halfLength, centerR - halfThickness),
                        new MapCanvasPoint(centerQ + halfLength + halfThickness, centerR),
                        new MapCanvasPoint(centerQ + halfLength, centerR + halfThickness),
                        new MapCanvasPoint(centerQ - halfLength, centerR + halfThickness),
                        new MapCanvasPoint(centerQ - halfLength - halfThickness, centerR));
            }

            private static List<MapCanvasPoint> verticalPill(
                    double centerQ,
                    double centerR,
                    double halfLength,
                    double halfThickness
            ) {
                return List.of(
                        new MapCanvasPoint(centerQ - halfThickness, centerR - halfLength),
                        new MapCanvasPoint(centerQ, centerR - halfLength - halfThickness),
                        new MapCanvasPoint(centerQ + halfThickness, centerR - halfLength),
                        new MapCanvasPoint(centerQ + halfThickness, centerR + halfLength),
                        new MapCanvasPoint(centerQ, centerR + halfLength + halfThickness),
                        new MapCanvasPoint(centerQ - halfThickness, centerR + halfLength));
            }

            private static List<MapCanvasPoint> circle(double centerQ, double centerR, double radius, int points) {
                List<MapCanvasPoint> result = new ArrayList<>();
                int safePoints = Math.max(8, points);
                for (int index = 0; index < safePoints; index++) {
                    double angle = Math.PI * 2.0 * index / safePoints;
                    result.add(new MapCanvasPoint(
                            centerQ + Math.cos(angle) * radius,
                            centerR + Math.sin(angle) * radius));
                }
                return List.copyOf(result);
            }

            private static List<MapCanvasPoint> partyTokenShape(DungeonMapRenderState.PartyToken token) {
                double forwardX = token.heading().dx();
                double forwardY = token.heading().dy();
                double sideX = -forwardY;
                double sideY = forwardX;
                double outerRadius = partyOuterRadiusScene();
                return List.of(
                        new MapCanvasPoint(
                                token.q() + forwardX * outerRadius * 1.18,
                                token.r() + forwardY * outerRadius * 1.18),
                        new MapCanvasPoint(
                                token.q() + forwardX * outerRadius * 0.54
                                        + sideX * outerRadius * 0.76,
                                token.r() + forwardY * outerRadius * 0.54
                                        + sideY * outerRadius * 0.76),
                        new MapCanvasPoint(
                                token.q() - forwardX * outerRadius * 0.92
                                        + sideX * outerRadius * 0.92,
                                token.r() - forwardY * outerRadius * 0.92
                                        + sideY * outerRadius * 0.92),
                        new MapCanvasPoint(
                                token.q() - forwardX * outerRadius * 1.02,
                                token.r() - forwardY * outerRadius * 1.02),
                        new MapCanvasPoint(
                                token.q() - forwardX * outerRadius * 0.92
                                        - sideX * outerRadius * 0.92,
                                token.r() - forwardY * outerRadius * 0.92
                                        - sideY * outerRadius * 0.92),
                        new MapCanvasPoint(
                                token.q() + forwardX * outerRadius * 0.54
                                        - sideX * outerRadius * 0.76,
                                token.r() + forwardY * outerRadius * 0.54
                                        - sideY * outerRadius * 0.76));
            }

            private static double markerHalfSizeScene() {
                return 0.34;
            }

            private static double markerHalfSizeScene(DungeonMapRenderState.Marker marker) {
                if (marker.isWallRunMarker()) {
                    return 0.16;
                }
                return marker.isDoorMarker() ? 0.28 : markerHalfSizeScene();
            }

            private static double partyOuterRadiusScene() {
                return 0.26;
            }
        }

        private static final class Overlay {

            private static double overlayAlpha(int z, int projectionLevel, double configuredOpacity) {
                int distance = Math.max(1, Math.abs(z - projectionLevel));
                return Math.max(0.05, Math.min(0.95, configuredOpacity / Math.sqrt(distance)));
            }
        }
    }

    private static final class SurfaceStyler {

        private static PaintStyle style(
                DungeonMapRenderState.Cell cell,
                DungeonMapRenderState displayModel,
                boolean hovered
        ) {
            if (cell.preview()) {
                return previewStyle(cell);
            }
            if (cell.z() != displayModel.projectionLevel()) {
                return overlayStyle(cell, displayModel);
            }
            if (!cell.selected() && hovered) {
                return new PaintStyle(
                        ScenePalette.blend(baseFill(cell), ScenePalette.HOVER_STROKE, 0.18),
                        ScenePalette.HOVER_STROKE,
                        1.8 / 32.0,
                        1.0,
                        false);
            }
            return new PaintStyle(
                    cell.selected() ? ScenePalette.SELECTED_FILL : baseFill(cell),
                    cell.selected() ? ScenePalette.SELECTED_STROKE : baseStroke(cell),
                    cell.selected() ? 2.4 / 32.0 : 1.0 / 32.0,
                    1.0,
                    false);
        }

        private static PaintStyle previewStyle(DungeonMapRenderState.Cell cell) {
            return new PaintStyle(
                    cell.destructivePreview() ? ScenePalette.DESTRUCTIVE_PREVIEW_FILL : ScenePalette.PREVIEW_FILL,
                    cell.destructivePreview() ? ScenePalette.DESTRUCTIVE_PREVIEW_STROKE : ScenePalette.PREVIEW_STROKE,
                    cell.selected() ? 2.4 / 32.0 : 1.0 / 32.0,
                    0.58,
                    false);
        }

        private static PaintStyle overlayStyle(
                DungeonMapRenderState.Cell cell,
                DungeonMapRenderState displayModel
        ) {
            boolean above = cell.z() > displayModel.projectionLevel();
            RenderColor tint = above ? ScenePalette.ABOVE_TINT : ScenePalette.BELOW_TINT;
            RenderColor baseFill = above ? ScenePalette.ROOM_FILL : ScenePalette.CORRIDOR_FILL;
            return new PaintStyle(
                    ScenePalette.blend(baseFill, tint, 0.56),
                    ScenePalette.blend(ScenePalette.ROOM_CELL_STROKE, tint, 0.62),
                    cell.selected() ? 2.4 / 32.0 : 1.0 / 32.0,
                    SceneGeometry.Overlay.overlayAlpha(cell.z(), displayModel.projectionLevel(), displayModel.overlaySettings().opacity()),
                    false);
        }

        private static RenderColor baseFill(DungeonMapRenderState.Cell cell) {
            return switch (cell.kind()) {
                case ROOM -> ScenePalette.ROOM_FILL;
                case CORRIDOR -> ScenePalette.CORRIDOR_FILL;
                case STAIR -> ScenePalette.STAIR_FILL;
                case TRANSITION -> ScenePalette.TRANSITION_FILL;
                case FEATURE_POI -> ScenePalette.FEATURE_POI_FILL;
                case FEATURE_OBJECT -> ScenePalette.FEATURE_OBJECT_FILL;
                case FEATURE_ENCOUNTER -> ScenePalette.FEATURE_ENCOUNTER_FILL;
            };
        }

        private static RenderColor baseStroke(DungeonMapRenderState.Cell cell) {
            return switch (cell.kind()) {
                case ROOM -> ScenePalette.ROOM_CELL_STROKE;
                case CORRIDOR, STAIR -> ScenePalette.CORRIDOR_STROKE;
                case TRANSITION -> ScenePalette.TRANSITION_STROKE;
                case FEATURE_POI -> ScenePalette.FEATURE_POI_STROKE;
                case FEATURE_OBJECT -> ScenePalette.FEATURE_OBJECT_STROKE;
                case FEATURE_ENCOUNTER -> ScenePalette.FEATURE_ENCOUNTER_STROKE;
            };
        }
    }

    private static final class EdgeStyler {

        private static PaintStyle style(
                DungeonMapRenderState.Edge edge,
                DungeonMapRenderState displayModel,
                boolean hovered
        ) {
            if (edge.preview()) {
                return new PaintStyle(null, ScenePalette.PREVIEW_STROKE, 2.6 / 32.0, 0.72, true);
            }
            if (edge.z() != displayModel.projectionLevel()) {
                return overlayStyle(edge, displayModel);
            }
            return visibleStyle(edge, hovered);
        }

        private static PaintStyle overlayStyle(
                DungeonMapRenderState.Edge edge,
                DungeonMapRenderState displayModel
        ) {
            return new PaintStyle(
                    null,
                    edge.isDoor() ? ScenePalette.DOOR_STROKE : ScenePalette.WALL_STROKE,
                    edge.isDoor() ? 3.6 / 32.0 : 2.0 / 32.0,
                    SceneGeometry.Overlay.overlayAlpha(edge.z(), displayModel.projectionLevel(), displayModel.overlaySettings().opacity()),
                    false);
        }

        private static PaintStyle visibleStyle(DungeonMapRenderState.Edge edge, boolean hovered) {
            RenderColor stroke = edge.selected()
                    ? ScenePalette.HIGHLIGHT_STROKE
                    : hovered ? ScenePalette.HOVER_STROKE : edge.isDoor() ? ScenePalette.DOOR_STROKE : ScenePalette.WALL_STROKE;
            double strokeWidth = edge.selected()
                    ? selectedStrokeWidth(edge)
                    : hovered ? hoverStrokeWidth(edge) : unselectedStrokeWidth(edge);
            return new PaintStyle(null, stroke, strokeWidth, 1.0, false);
        }

        private static double selectedStrokeWidth(DungeonMapRenderState.Edge edge) {
            return edge.isDoor() ? 4.2 / 32.0 : 2.8 / 32.0;
        }

        private static double unselectedStrokeWidth(DungeonMapRenderState.Edge edge) {
            return edge.isDoor() ? 3.6 / 32.0 : 2.0 / 32.0;
        }

        private static double hoverStrokeWidth(DungeonMapRenderState.Edge edge) {
            return edge.isDoor() ? 3.9 / 32.0 : 2.4 / 32.0;
        }
    }

    private static final class MarkerStyler {
        private static final Map<DungeonMapRenderState.MarkerKind, RenderColor> MARKER_STROKES = markerStrokes();

        private static PaintStyle style(
                DungeonMapRenderState.Marker marker,
                DungeonMapRenderState displayModel,
                boolean hovered
        ) {
            if (marker.preview()) {
                return new PaintStyle(
                        ScenePalette.PREVIEW_FILL,
                        ScenePalette.PREVIEW_STROKE,
                        marker.selected() ? 2.2 / 32.0 : 1.4 / 32.0,
                        0.72,
                        false);
            }
            if (marker.isWallRunMarker()) {
                return new PaintStyle(
                        fill(marker),
                        stroke(marker, hovered),
                        marker.selected() ? 1.8 / 32.0 : hovered ? 1.6 / 32.0 : 1.2 / 32.0,
                        marker.z() == displayModel.projectionLevel()
                                ? 0.92
                                : SceneGeometry.Overlay.overlayAlpha(
                                        marker.z(),
                                        displayModel.projectionLevel(),
                                        displayModel.overlaySettings().opacity()) * 0.92,
                        false);
            }
            return new PaintStyle(
                    fill(marker),
                    stroke(marker, hovered),
                    marker.selected() ? 2.2 / 32.0 : hovered ? 1.9 / 32.0 : 1.4 / 32.0,
                    markerAlpha(marker, displayModel, hovered),
                    false);
        }

        private static double markerAlpha(
                DungeonMapRenderState.Marker marker,
                DungeonMapRenderState displayModel,
                boolean hovered
        ) {
            if (marker.isDoorMarker() && !marker.selected() && !hovered) {
                return 0.0;
            }
            return marker.z() == displayModel.projectionLevel()
                    ? 1.0
                    : SceneGeometry.Overlay.overlayAlpha(
                            marker.z(),
                            displayModel.projectionLevel(),
                            displayModel.overlaySettings().opacity());
        }

        private static RenderColor fill(DungeonMapRenderState.Marker marker) {
            return switch (marker.kind()) {
                case DOOR, CLUSTER -> ScenePalette.LABEL_FILL;
                case STAIR -> ScenePalette.STAIR_FILL;
                case TRANSITION -> ScenePalette.TRANSITION_FILL;
                case WAYPOINT -> ScenePalette.PREVIEW_FILL;
                case FEATURE_POI -> ScenePalette.FEATURE_POI_FILL;
                case FEATURE_OBJECT -> ScenePalette.FEATURE_OBJECT_FILL;
                case FEATURE_ENCOUNTER -> ScenePalette.FEATURE_ENCOUNTER_FILL;
            };
        }

        private static RenderColor stroke(DungeonMapRenderState.Marker marker, boolean hovered) {
            if (marker.selected()) {
                return ScenePalette.HIGHLIGHT_STROKE;
            }
            if (hovered) {
                return ScenePalette.HOVER_STROKE;
            }
            return MARKER_STROKES.get(marker.kind());
        }

        private static Map<DungeonMapRenderState.MarkerKind, RenderColor> markerStrokes() {
            Map<DungeonMapRenderState.MarkerKind, RenderColor> strokes =
                    new EnumMap<>(DungeonMapRenderState.MarkerKind.class);
            strokes.put(DungeonMapRenderState.MarkerKind.DOOR, ScenePalette.DOOR_STROKE);
            strokes.put(DungeonMapRenderState.MarkerKind.STAIR, ScenePalette.CORRIDOR_STROKE);
            strokes.put(DungeonMapRenderState.MarkerKind.TRANSITION, ScenePalette.TRANSITION_STROKE);
            strokes.put(DungeonMapRenderState.MarkerKind.WAYPOINT, ScenePalette.PREVIEW_STROKE);
            strokes.put(DungeonMapRenderState.MarkerKind.CLUSTER, ScenePalette.LABEL_BORDER);
            strokes.put(DungeonMapRenderState.MarkerKind.FEATURE_POI, ScenePalette.FEATURE_POI_STROKE);
            strokes.put(DungeonMapRenderState.MarkerKind.FEATURE_OBJECT, ScenePalette.FEATURE_OBJECT_STROKE);
            strokes.put(DungeonMapRenderState.MarkerKind.FEATURE_ENCOUNTER, ScenePalette.FEATURE_ENCOUNTER_STROKE);
            return Map.copyOf(strokes);
        }
    }

    private static final class LabelStyler {

        private static PaintStyle style(
                DungeonMapRenderState.Label label,
                DungeonMapRenderState displayModel,
                boolean hovered
        ) {
            if (DungeonMapContentModel.ROOM_LABEL_KIND.equals(label.labelKind())) {
                return roomLabelStyle(label, displayModel);
            }
            return framedLabelStyle(label, displayModel, hovered);
        }

        private static PaintStyle roomLabelStyle(
                DungeonMapRenderState.Label label,
                DungeonMapRenderState displayModel
        ) {
            double labelAlpha = label.preview()
                    ? alpha(label, displayModel) * 0.92
                    : label.selected() ? alpha(label, displayModel) : alpha(label, displayModel) * 0.72;
            return new PaintStyle(
                    null,
                    null,
                    0.0,
                    labelAlpha,
                    false);
        }

        private static PaintStyle framedLabelStyle(
                DungeonMapRenderState.Label label,
                DungeonMapRenderState displayModel,
                boolean hovered
        ) {
            return new PaintStyle(
                    label.preview() ? ScenePalette.PREVIEW_FILL : ScenePalette.LABEL_FILL,
                    label.preview()
                            ? ScenePalette.PREVIEW_STROKE
                            : label.selected()
                            ? ScenePalette.HIGHLIGHT_STROKE
                            : hovered ? ScenePalette.HOVER_STROKE : ScenePalette.LABEL_BORDER,
                    (label.selected() ? 2.0 : hovered ? 1.6 : 1.0) / 32.0,
                    alpha(label, displayModel),
                    false);
        }

        private static double alpha(
                DungeonMapRenderState.Label label,
                DungeonMapRenderState displayModel
        ) {
            if (label.z() != displayModel.projectionLevel()) {
                return SceneGeometry.Overlay.overlayAlpha(
                        label.z(),
                        displayModel.projectionLevel(),
                        displayModel.overlaySettings().opacity());
            }
            return label.preview() ? 0.76 : 1.0;
        }
    }

    private static final class ScenePalette {

        private static final RenderColor ROOM_FILL = color(0x2a, 0x32, 0x38, 1.0);
        private static final RenderColor ROOM_CELL_STROKE = color(0x6d, 0x78, 0x81, 0.72);
        private static final RenderColor WALL_STROKE = color(0x8a, 0x6a, 0x35, 1.0);
        private static final RenderColor HIGHLIGHT_STROKE = color(0xf1, 0xd3, 0x8a, 1.0);
        private static final RenderColor HOVER_STROKE = color(0x9d, 0xe9, 0xff, 0.96);
        private static final RenderColor CORRIDOR_FILL = color(0x3b, 0x50, 0x53, 0.8);
        private static final RenderColor CORRIDOR_STROKE = color(0x91, 0xb6, 0xb0, 1.0);
        private static final RenderColor SELECTED_FILL = color(0x58, 0x70, 0x6e, 0.95);
        private static final RenderColor SELECTED_STROKE = color(0xd7, 0xec, 0xe7, 1.0);
        private static final RenderColor PREVIEW_FILL = color(0xd7, 0xec, 0xe7, 0.72);
        private static final RenderColor PREVIEW_STROKE = color(0xf1, 0xd3, 0x8a, 1.0);
        private static final RenderColor PARTY_FILL = color(0xff, 0xb6, 0x2a, 1.0);
        private static final RenderColor PARTY_STROKE = color(0xff, 0xf0, 0xc6, 1.0);
        private static final RenderColor LABEL_FILL = color(0x18, 0x1f, 0x24, 1.0);
        private static final RenderColor LABEL_BORDER = color(0x76, 0x84, 0x8d, 1.0);
        private static final RenderColor LABEL_TEXT = color(0xf2, 0xf4, 0xf5, 1.0);
        private static final RenderColor ROOM_LABEL_TEXT = color(0x93, 0x9d, 0xa5, 0.82);
        private static final RenderColor SELECTED_ROOM_LABEL_TEXT = color(0xe8, 0xee, 0xf2, 1.0);
        private static final RenderColor PREVIEW_ROOM_LABEL_TEXT = color(0x24, 0x32, 0x36, 0.94);
        private static final RenderColor STAIR_FILL = color(0x4b, 0x3a, 0x6e, 0.95);
        private static final RenderColor TRANSITION_FILL = color(0x6f, 0x3f, 0x28, 0.95);
        private static final RenderColor TRANSITION_STROKE = color(0xe0, 0xa3, 0x6a, 1.0);
        private static final RenderColor FEATURE_POI_FILL = color(0x2f, 0x65, 0x4d, 0.95);
        private static final RenderColor FEATURE_POI_STROKE = color(0xa8, 0xde, 0xbf, 1.0);
        private static final RenderColor FEATURE_OBJECT_FILL = color(0x6a, 0x53, 0x24, 0.95);
        private static final RenderColor FEATURE_OBJECT_STROKE = color(0xf0, 0xce, 0x88, 1.0);
        private static final RenderColor FEATURE_ENCOUNTER_FILL = color(0x6c, 0x2f, 0x3d, 0.95);
        private static final RenderColor FEATURE_ENCOUNTER_STROKE = color(0xf0, 0xb0, 0xbe, 1.0);
        private static final RenderColor DOOR_STROKE = color(0xc6, 0xe2, 0xff, 1.0);
        private static final RenderColor GRAPH_LINK = color(0x88, 0x96, 0xa1, 0.9);
        private static final RenderColor GRAPH_NODE_FILL = color(0x21, 0x29, 0x2f, 1.0);
        private static final RenderColor ABOVE_TINT = color(0x86, 0x90, 0xd8, 0.75);
        private static final RenderColor BELOW_TINT = color(0x55, 0x8a, 0x9c, 0.75);
        private static final RenderColor DESTRUCTIVE_PREVIEW_FILL = color(0x99, 0x43, 0x3d, 1.0);
        private static final RenderColor DESTRUCTIVE_PREVIEW_STROKE = color(0xff, 0xc1, 0x87, 1.0);

        private static RenderColor blend(RenderColor base, RenderColor tint, double weight) {
            return RenderColor.blend(base, tint, weight);
        }

        private static RenderColor color(int red, int green, int blue, double opacity) {
            return RenderColor.color(red, green, blue, opacity);
        }
    }

}
