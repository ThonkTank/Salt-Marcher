package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javafx.scene.paint.Color;
import org.jspecify.annotations.Nullable;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasView;
import src.view.slotcontent.primitives.mapcanvas.MapRenderScene;

public class DungeonMapView extends MapCanvasView {

    private final DungeonMapCanvasAdapter canvasAdapter = new DungeonMapCanvasAdapter();

    public DungeonMapView() {
        super();
    }

    public void bind(DungeonMapContentModel presentationModel) {
        if (presentationModel == null) {
            return;
        }
        renderSceneProperty().set(canvasAdapter.toScene(presentationModel.renderStateProperty().get()));
        presentationModel.renderStateProperty().addListener((ignored, before, after) ->
                renderSceneProperty().set(canvasAdapter.toScene(after)));
    }

    private static final class DungeonMapCanvasAdapter {

        private static final double LABEL_HEIGHT_SCENE = 24.0 / 32.0;
        private static final double LABEL_PADDING_SCENE = 16.0 / 32.0;
        private static final double LABEL_CHAR_WIDTH_SCENE = 7.2 / 32.0;
        private static final double MARKER_HALF_SIZE_SCENE = 0.34;
        private static final double PARTY_OUTER_RADIUS_SCENE = 0.26;

        private MapRenderScene toScene(DungeonMapRenderState displayModel) {
            if (displayModel == null) {
                return MapRenderScene.empty("Dungeon Map");
            }

            List<MapRenderScene.SurfacePrimitive> surfaces = new ArrayList<>();
            List<MapRenderScene.BoundaryPrimitive> boundaries = new ArrayList<>();
            List<MapRenderScene.GlyphPrimitive> glyphs = new ArrayList<>();
            List<MapRenderScene.TextPrimitive> texts = new ArrayList<>();
            List<MapRenderScene.RelationPrimitive> relations = new ArrayList<>();
            List<MapRenderScene.ActorPrimitive> actors = new ArrayList<>();

            if (displayModel.viewMode() == DungeonMapRenderState.ViewMode.GRAPH) {
                buildGraphScene(displayModel, surfaces, texts, relations);
            } else {
                buildGridScene(displayModel, surfaces, boundaries, glyphs, texts, actors);
            }

            return new MapRenderScene(
                    displayModel.title(),
                    displayModel.subtitle(),
                    displayModel.modeLabel(),
                    displayModel.statusLabel(),
                    displayModel.summaryLabel(),
                    displayModel.mapLoaded(),
                    displayModel.overlayMessage(),
                    displayModel.viewMode() == DungeonMapRenderState.ViewMode.GRAPH
                            ? MapRenderScene.ViewMode.GRAPH
                            : MapRenderScene.ViewMode.GRID,
                    surfaces,
                    boundaries,
                    glyphs,
                    texts,
                    relations,
                    actors,
                    List.of());
        }

        private static void buildGridScene(
                DungeonMapRenderState displayModel,
                List<MapRenderScene.SurfacePrimitive> surfaces,
                List<MapRenderScene.BoundaryPrimitive> boundaries,
                List<MapRenderScene.GlyphPrimitive> glyphs,
                List<MapRenderScene.TextPrimitive> texts,
                List<MapRenderScene.ActorPrimitive> actors
        ) {
            List<DungeonMapRenderState.Cell> cells = displayModel.cells();
            for (int index = 0; index < cells.size(); index++) {
                DungeonMapRenderState.Cell cell = cells.get(index);
                if (!includeLevel(displayModel, cell.z())) {
                    continue;
                }
                surfaces.add(new MapRenderScene.SurfacePrimitive(
                        cellHitRef(cell),
                        selectionRef(cell.topologyRef()),
                        cell.z(),
                        square(cell.q(), cell.r(), 1.0),
                        surfaceStyle(cell, displayModel)));
            }
            List<DungeonMapRenderState.Edge> edges = displayModel.edges();
            for (int index = 0; index < edges.size(); index++) {
                DungeonMapRenderState.Edge edge = edges.get(index);
                if (!includeLevel(displayModel, edge.z())) {
                    continue;
                }
                boundaries.add(new MapRenderScene.BoundaryPrimitive(
                        edgeHitRef(edge),
                        selectionRef(edge.topologyRef()),
                        edge.z(),
                        List.of(
                                new MapRenderScene.ScenePoint(edge.startQ(), edge.startR()),
                                new MapRenderScene.ScenePoint(edge.endQ(), edge.endR())),
                        edgeStyle(edge, displayModel)));
            }
            List<DungeonMapRenderState.Marker> markers = displayModel.markers();
            for (int index = 0; index < markers.size(); index++) {
                DungeonMapRenderState.Marker marker = markers.get(index);
                if (!includeLevel(displayModel, marker.z())) {
                    continue;
                }
                glyphs.add(new MapRenderScene.GlyphPrimitive(
                        markerHitRef(marker),
                        selectionRef(marker.handle().topologyRef()),
                        marker.z(),
                        markerShape(marker),
                        markerStyle(marker, displayModel),
                        abbreviateLabel(marker.label(), marker.kind() == DungeonMapRenderState.MarkerKind.DOOR ? 1 : 3),
                        labelText()));
            }
            List<DungeonMapRenderState.Label> labels = displayModel.labels();
            for (int index = 0; index < labels.size(); index++) {
                DungeonMapRenderState.Label label = labels.get(index);
                if (!includeLevel(displayModel, label.z())) {
                    continue;
                }
                texts.add(new MapRenderScene.TextPrimitive(
                        labelHitRef(label),
                        selectionRef(label.topologyRef()),
                        label.z(),
                        label.label(),
                        label.q(),
                        label.r(),
                        labelWidthScene(label.label()),
                        LABEL_HEIGHT_SCENE,
                        labelStyle(label, displayModel),
                        labelText()));
            }
            DungeonMapRenderState.PartyToken token = displayModel.partyToken();
            if (token != null && token.visible() && includeLevel(displayModel, token.z())) {
                actors.add(new MapRenderScene.ActorPrimitive(
                        "",
                        null,
                        token.z(),
                        partyTokenShape(token),
                        new MapRenderScene.PaintStyle(
                                partyFill(),
                                partyStroke(),
                                1.8 / 32.0,
                                1.0,
                                false)));
            }
        }

        private static void buildGraphScene(
                DungeonMapRenderState displayModel,
                List<MapRenderScene.SurfacePrimitive> surfaces,
                List<MapRenderScene.TextPrimitive> texts,
                List<MapRenderScene.RelationPrimitive> relations
        ) {
            List<DungeonMapRenderState.GraphNode> graphNodes = displayModel.graphNodes();
            List<DungeonMapRenderState.GraphLink> graphLinks = displayModel.graphLinks();
            Map<Long, DungeonMapRenderState.GraphNode> nodesById = new LinkedHashMap<>();
            for (DungeonMapRenderState.GraphNode node : graphNodes) {
                nodesById.put(node.id(), node);
            }
            for (DungeonMapRenderState.GraphLink link : graphLinks) {
                DungeonMapRenderState.GraphNode from = nodesById.get(link.fromId());
                DungeonMapRenderState.GraphNode to = nodesById.get(link.toId());
                if (from == null || to == null) {
                    continue;
                }
                relations.add(new MapRenderScene.RelationPrimitive(
                        "",
                        displayModel.projectionLevel(),
                        List.of(
                                new MapRenderScene.ScenePoint(from.q(), from.r()),
                                new MapRenderScene.ScenePoint(to.q(), to.r())),
                        new MapRenderScene.PaintStyle(
                                null,
                                link.selected() ? highlightStroke() : graphLink(),
                                link.selected() ? 2.4 / 32.0 : 1.7 / 32.0,
                                1.0,
                                false)));
            }
            for (int index = 0; index < graphNodes.size(); index++) {
                DungeonMapRenderState.GraphNode node = graphNodes.get(index);
                surfaces.add(new MapRenderScene.SurfacePrimitive(
                        graphNodeHitRef(node),
                        "ROOM:" + node.id(),
                        displayModel.projectionLevel(),
                        roundedRect(node.q(), node.r(), 1.8, 1.1),
                        new MapRenderScene.PaintStyle(
                                graphNodeFill(),
                                node.selected() ? highlightStroke() : roomCellStroke(),
                                node.selected() ? 2.4 / 32.0 : 1.2 / 32.0,
                                1.0,
                                false)));
                texts.add(new MapRenderScene.TextPrimitive(
                        graphNodeHitRef(node),
                        "ROOM:" + node.id(),
                        displayModel.projectionLevel(),
                        node.label(),
                        node.q(),
                        node.r(),
                        Math.max(1.8, labelWidthScene(node.label())),
                        LABEL_HEIGHT_SCENE,
                        new MapRenderScene.PaintStyle(null, null, 0.0, 1.0, false),
                        labelText()));
            }
        }

        private static @Nullable String selectionRef(DungeonMapRenderState.TopologyRef topologyRef) {
            if (topologyRef == null || topologyRef.isEmpty()) {
                return null;
            }
            return topologyRef.kind() + ":" + topologyRef.id();
        }

        private static String cellHitRef(DungeonMapRenderState.Cell cell) {
            return "cell:" + cell.kind().name()
                    + ":" + cell.ownerId()
                    + ":" + cell.clusterId()
                    + ":" + cell.topologyRef().kind()
                    + ":" + cell.topologyRef().id();
        }

        private static String edgeHitRef(DungeonMapRenderState.Edge edge) {
            return "edge:" + edge.kind().name()
                    + ":" + edge.ownerId()
                    + ":" + edge.topologyRef().kind()
                    + ":" + edge.topologyRef().id()
                    + ":" + edge.z()
                    + ":" + sceneCoordinate(edge.startQ())
                    + ":" + sceneCoordinate(edge.startR())
                    + ":" + sceneCoordinate(edge.endQ())
                    + ":" + sceneCoordinate(edge.endR());
        }

        private static String labelHitRef(DungeonMapRenderState.Label label) {
            return "label:" + label.ownerId()
                    + ":" + label.clusterId()
                    + ":" + label.topologyRef().kind()
                    + ":" + label.topologyRef().id();
        }

        private static String markerHitRef(DungeonMapRenderState.Marker marker) {
            DungeonMapRenderState.MarkerHandle handle = marker.handle();
            return "marker:" + handle.kind()
                    + ":" + handle.topologyRef().kind()
                    + ":" + handle.topologyRef().id()
                    + ":" + handle.ownerId()
                    + ":" + handle.clusterId()
                    + ":" + handle.corridorId()
                    + ":" + handle.roomId()
                    + ":" + handle.index()
                    + ":" + handle.q()
                    + ":" + handle.r()
                    + ":" + handle.level()
                    + ":" + handle.direction();
        }

        private static String graphNodeHitRef(DungeonMapRenderState.GraphNode node) {
            return "graph-node:ROOM:" + node.id() + ":" + node.clusterId();
        }

        private static int sceneCoordinate(double coordinate) {
            return (int) Math.round(coordinate);
        }

        private static boolean includeLevel(DungeonMapRenderState displayModel, int level) {
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

        private static MapRenderScene.PaintStyle surfaceStyle(
                DungeonMapRenderState.Cell cell,
                DungeonMapRenderState displayModel
        ) {
            if (cell.preview()) {
                return previewSurfaceStyle(cell);
            }
            if (cell.z() != displayModel.projectionLevel()) {
                return overlaySurfaceStyle(cell, displayModel);
            }
            Color fill = cell.selected() ? selectedFill() : baseSurfaceFill(cell);
            Color stroke = cell.selected() ? selectedStroke() : baseSurfaceStroke(cell);
            return new MapRenderScene.PaintStyle(
                    fill,
                    stroke,
                    cell.selected() ? 2.4 / 32.0 : 1.0 / 32.0,
                    1.0,
                    false);
        }

        private static MapRenderScene.PaintStyle previewSurfaceStyle(
                DungeonMapRenderState.Cell cell
        ) {
            return new MapRenderScene.PaintStyle(
                    cell.destructivePreview() ? color(0x99, 0x43, 0x3d, 1.0) : previewFill(),
                    cell.destructivePreview() ? color(0xff, 0xc1, 0x87, 1.0) : previewStroke(),
                    cell.selected() ? 2.4 / 32.0 : 1.0 / 32.0,
                    0.58,
                    false);
        }

        private static MapRenderScene.PaintStyle overlaySurfaceStyle(
                DungeonMapRenderState.Cell cell,
                DungeonMapRenderState displayModel
        ) {
            boolean above = cell.z() > displayModel.projectionLevel();
            Color tint = above ? aboveTint() : belowTint();
            Color baseFill = above ? roomFill() : corridorFill();
            return new MapRenderScene.PaintStyle(
                    blend(baseFill, tint, 0.56),
                    blend(roomCellStroke(), tint, 0.62),
                    cell.selected() ? 2.4 / 32.0 : 1.0 / 32.0,
                    overlayAlpha(cell.z(), displayModel.projectionLevel(), displayModel.overlaySettings().opacity()),
                    false);
        }

        private static Color baseSurfaceFill(DungeonMapRenderState.Cell cell) {
            return switch (cell.kind()) {
                case ROOM -> roomFill();
                case CORRIDOR -> corridorFill();
                case STAIR -> stairFill();
                case TRANSITION -> transitionFill();
            };
        }

        private static Color baseSurfaceStroke(DungeonMapRenderState.Cell cell) {
            return switch (cell.kind()) {
                case ROOM -> roomCellStroke();
                case CORRIDOR, STAIR -> corridorStroke();
                case TRANSITION -> transitionStroke();
            };
        }

        private static MapRenderScene.PaintStyle edgeStyle(
                DungeonMapRenderState.Edge edge,
                DungeonMapRenderState displayModel
        ) {
            Color stroke;
            double alpha = 1.0;
            boolean dashed = false;
            double strokeWidth;
            if (edge.preview()) {
                stroke = previewStroke();
                alpha = 0.72;
                dashed = true;
                strokeWidth = 2.6 / 32.0;
            } else if (edge.z() != displayModel.projectionLevel()) {
                stroke = edge.kind() == DungeonMapRenderState.EdgeKind.DOOR ? doorStroke() : wallStroke();
                alpha = overlayAlpha(edge.z(), displayModel.projectionLevel(), displayModel.overlaySettings().opacity());
                strokeWidth = edge.kind() == DungeonMapRenderState.EdgeKind.DOOR ? 3.6 / 32.0 : 2.0 / 32.0;
            } else {
                stroke = edge.kind() == DungeonMapRenderState.EdgeKind.DOOR
                        ? doorStroke()
                        : edge.selected() ? highlightStroke() : wallStroke();
                strokeWidth = edge.kind() == DungeonMapRenderState.EdgeKind.DOOR
                        ? 3.6 / 32.0
                        : edge.selected() ? 2.8 / 32.0 : 2.0 / 32.0;
            }
            return new MapRenderScene.PaintStyle(null, stroke, strokeWidth, alpha, dashed);
        }

        private static MapRenderScene.PaintStyle markerStyle(
                DungeonMapRenderState.Marker marker,
                DungeonMapRenderState displayModel
        ) {
            Color fill;
            Color stroke;
            double alpha = 1.0;
            if (marker.preview()) {
                fill = previewFill();
                stroke = previewStroke();
                alpha = 0.72;
            } else {
                fill = switch (marker.kind()) {
                    case DOOR, CLUSTER -> labelFill();
                    case STAIR -> stairFill();
                    case TRANSITION -> transitionFill();
                    case WAYPOINT -> previewFill();
                };
                stroke = marker.selected()
                        ? highlightStroke()
                        : switch (marker.kind()) {
                            case DOOR -> doorStroke();
                            case STAIR -> corridorStroke();
                            case TRANSITION -> transitionStroke();
                            case WAYPOINT -> previewStroke();
                            case CLUSTER -> labelBorder();
                        };
                if (marker.z() != displayModel.projectionLevel()) {
                    alpha = overlayAlpha(
                            marker.z(),
                            displayModel.projectionLevel(),
                            displayModel.overlaySettings().opacity());
                }
            }
            return new MapRenderScene.PaintStyle(
                    fill,
                    stroke,
                    marker.selected() ? 2.2 / 32.0 : 1.4 / 32.0,
                    alpha,
                    false);
        }

        private static MapRenderScene.PaintStyle labelStyle(
                DungeonMapRenderState.Label label,
                DungeonMapRenderState displayModel
        ) {
            double alpha = 1.0;
            if (label.z() != displayModel.projectionLevel()) {
                alpha = overlayAlpha(label.z(), displayModel.projectionLevel(), displayModel.overlaySettings().opacity());
            } else if (label.preview()) {
                alpha = 0.76;
            }
            return new MapRenderScene.PaintStyle(
                    label.preview() ? previewFill() : labelFill(),
                    label.preview() ? previewStroke() : label.selected() ? highlightStroke() : labelBorder(),
                    (label.selected() ? 2.0 : 1.0) / 32.0,
                    alpha,
                    false);
        }

        private static List<MapRenderScene.ScenePoint> square(double q, double r, double size) {
            return List.of(
                    new MapRenderScene.ScenePoint(q, r),
                    new MapRenderScene.ScenePoint(q + size, r),
                    new MapRenderScene.ScenePoint(q + size, r + size),
                    new MapRenderScene.ScenePoint(q, r + size));
        }

        private static List<MapRenderScene.ScenePoint> roundedRect(
                double centerQ,
                double centerR,
                double width,
                double height
        ) {
            double halfWidth = width / 2.0;
            double halfHeight = height / 2.0;
            return List.of(
                    new MapRenderScene.ScenePoint(centerQ - halfWidth, centerR - halfHeight),
                    new MapRenderScene.ScenePoint(centerQ + halfWidth, centerR - halfHeight),
                    new MapRenderScene.ScenePoint(centerQ + halfWidth, centerR + halfHeight),
                    new MapRenderScene.ScenePoint(centerQ - halfWidth, centerR + halfHeight));
        }

        private static List<MapRenderScene.ScenePoint> markerShape(
                DungeonMapRenderState.Marker marker
        ) {
            double half = marker.kind() == DungeonMapRenderState.MarkerKind.DOOR ? 0.28 : MARKER_HALF_SIZE_SCENE;
            return square(marker.q() - half, marker.r() - half, half * 2.0);
        }

        private static List<MapRenderScene.ScenePoint> partyTokenShape(
                DungeonMapRenderState.PartyToken token
        ) {
            double forwardX = token.heading().dx();
            double forwardY = token.heading().dy();
            double sideX = -forwardY;
            double sideY = forwardX;
            return List.of(
                    new MapRenderScene.ScenePoint(
                            token.q() + forwardX * PARTY_OUTER_RADIUS_SCENE * 1.18,
                            token.r() + forwardY * PARTY_OUTER_RADIUS_SCENE * 1.18),
                    new MapRenderScene.ScenePoint(
                            token.q() + forwardX * PARTY_OUTER_RADIUS_SCENE * 0.54
                                    + sideX * PARTY_OUTER_RADIUS_SCENE * 0.76,
                            token.r() + forwardY * PARTY_OUTER_RADIUS_SCENE * 0.54
                                    + sideY * PARTY_OUTER_RADIUS_SCENE * 0.76),
                    new MapRenderScene.ScenePoint(
                            token.q() - forwardX * PARTY_OUTER_RADIUS_SCENE * 0.92
                                    + sideX * PARTY_OUTER_RADIUS_SCENE * 0.92,
                            token.r() - forwardY * PARTY_OUTER_RADIUS_SCENE * 0.92
                                    + sideY * PARTY_OUTER_RADIUS_SCENE * 0.92),
                    new MapRenderScene.ScenePoint(
                            token.q() - forwardX * PARTY_OUTER_RADIUS_SCENE * 1.02,
                            token.r() - forwardY * PARTY_OUTER_RADIUS_SCENE * 1.02),
                    new MapRenderScene.ScenePoint(
                            token.q() - forwardX * PARTY_OUTER_RADIUS_SCENE * 0.92
                                    - sideX * PARTY_OUTER_RADIUS_SCENE * 0.92,
                            token.r() - forwardY * PARTY_OUTER_RADIUS_SCENE * 0.92
                                    - sideY * PARTY_OUTER_RADIUS_SCENE * 0.92),
                    new MapRenderScene.ScenePoint(
                            token.q() + forwardX * PARTY_OUTER_RADIUS_SCENE * 0.54
                                    - sideX * PARTY_OUTER_RADIUS_SCENE * 0.76,
                            token.r() + forwardY * PARTY_OUTER_RADIUS_SCENE * 0.54
                                    - sideY * PARTY_OUTER_RADIUS_SCENE * 0.76));
        }

        private static double labelWidthScene(String label) {
            return Math.max(
                    56.0 / 32.0,
                    Math.min(180.0 / 32.0, label.length() * LABEL_CHAR_WIDTH_SCENE + LABEL_PADDING_SCENE));
        }

        private static double overlayAlpha(int z, int projectionLevel, double configuredOpacity) {
            int distance = Math.max(1, Math.abs(z - projectionLevel));
            return Math.max(0.05, Math.min(0.95, configuredOpacity / Math.sqrt(distance)));
        }

        private static String abbreviateLabel(String label, int maxLength) {
            if (label == null || label.length() <= maxLength) {
                return label == null ? "" : label;
            }
            return label.substring(0, Math.max(1, maxLength - 1)) + ".";
        }

        private static Color blend(Color base, Color tint, double weight) {
            double clampedWeight = Math.max(0.0, Math.min(1.0, weight));
            double inverseWeight = 1.0 - clampedWeight;
            return new Color(
                    base.getRed() * inverseWeight + tint.getRed() * clampedWeight,
                    base.getGreen() * inverseWeight + tint.getGreen() * clampedWeight,
                    base.getBlue() * inverseWeight + tint.getBlue() * clampedWeight,
                    base.getOpacity() * inverseWeight + tint.getOpacity() * clampedWeight);
        }

        private static Color color(int red, int green, int blue, double opacity) {
            return new Color(red / 255.0, green / 255.0, blue / 255.0, opacity);
        }

        private static Color roomFill() {
            return color(0x2a, 0x32, 0x38, 1.0);
        }

        private static Color roomCellStroke() {
            return color(0x6d, 0x78, 0x81, 0.72);
        }

        private static Color wallStroke() {
            return color(0x8a, 0x6a, 0x35, 1.0);
        }

        private static Color highlightStroke() {
            return color(0xf1, 0xd3, 0x8a, 1.0);
        }

        private static Color corridorFill() {
            return color(0x3b, 0x50, 0x53, 0.8);
        }

        private static Color corridorStroke() {
            return color(0x91, 0xb6, 0xb0, 1.0);
        }

        private static Color selectedFill() {
            return color(0x58, 0x70, 0x6e, 0.95);
        }

        private static Color selectedStroke() {
            return color(0xd7, 0xec, 0xe7, 1.0);
        }

        private static Color previewFill() {
            return color(0xd7, 0xec, 0xe7, 0.72);
        }

        private static Color previewStroke() {
            return color(0xf1, 0xd3, 0x8a, 1.0);
        }

        private static Color partyFill() {
            return color(0xff, 0xb6, 0x2a, 1.0);
        }

        private static Color partyStroke() {
            return color(0xff, 0xf0, 0xc6, 1.0);
        }

        private static Color labelFill() {
            return color(0x18, 0x1f, 0x24, 1.0);
        }

        private static Color labelBorder() {
            return color(0x76, 0x84, 0x8d, 1.0);
        }

        private static Color labelText() {
            return color(0xf2, 0xf4, 0xf5, 1.0);
        }

        private static Color stairFill() {
            return color(0x4b, 0x3a, 0x6e, 0.95);
        }

        private static Color transitionFill() {
            return color(0x6f, 0x3f, 0x28, 0.95);
        }

        private static Color transitionStroke() {
            return color(0xe0, 0xa3, 0x6a, 1.0);
        }

        private static Color doorStroke() {
            return color(0xc6, 0xe2, 0xff, 1.0);
        }

        private static Color graphLink() {
            return color(0x88, 0x96, 0xa1, 0.9);
        }

        private static Color graphNodeFill() {
            return color(0x21, 0x29, 0x2f, 1.0);
        }

        private static Color aboveTint() {
            return color(0x86, 0x90, 0xd8, 0.75);
        }

        private static Color belowTint() {
            return color(0x55, 0x8a, 0x9c, 0.75);
        }
    }
}
