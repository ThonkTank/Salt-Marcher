package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.published.DungeonEditorSnapshot;
import src.domain.travel.published.TravelDungeonSnapshot;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel.BoundaryPrimitive;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel.GlyphPrimitive;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel.HitArea;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel.MapCanvasPoint;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel.MapCanvasPolygonPrimitive;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel.OverlayPrimitive;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel.PaintStyle;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel.PolygonHitArea;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel.PolylineHitArea;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel.RelationPrimitive;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel.RenderScene;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel.SceneColor;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel.TextPrimitive;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasViewInputEvent;

public final class DungeonMapContentModel {

    private static final SceneProjector SCENE_PROJECTOR = new SceneProjector();

    private final String placeholderTitle;
    private final MapCanvasContentModel mapCanvasContentModel;
    private DungeonMapRenderState renderState;

    public DungeonMapContentModel(String placeholderTitle, boolean editorMode) {
        this.placeholderTitle = normalizePlaceholderTitle(placeholderTitle);
        renderState = DungeonMapRenderState.empty(this.placeholderTitle, editorMode);
        mapCanvasContentModel = new MapCanvasContentModel(this.placeholderTitle);
        mapCanvasContentModel.showRenderScene(SCENE_PROJECTOR.toScene(renderState));
    }

    public MapCanvasContentModel mapCanvasContentModel() {
        return mapCanvasContentModel;
    }

    public void selectViewMode(DungeonMapRenderState.ViewMode nextViewMode) {
        showRenderState(renderState.withViewMode(nextViewMode));
    }

    public void selectOverlayMode(DungeonMapRenderState.OverlayMode nextOverlayMode) {
        DungeonMapRenderState.LevelOverlaySettings currentSettings = renderState.overlaySettings();
        showRenderState(renderState.withOverlaySettings(new DungeonMapRenderState.LevelOverlaySettings(
                nextOverlayMode,
                currentSettings.levelRange(),
                currentSettings.opacity(),
                currentSettings.selectedLevels())));
    }

    public void showOverlaySettings(DungeonMapRenderState.LevelOverlaySettings nextOverlaySettings) {
        showRenderState(renderState.withOverlaySettings(nextOverlaySettings));
    }

    public void showProjectionLevel(int nextProjectionLevel) {
        showRenderState(renderState.withProjectionLevel(nextProjectionLevel));
    }

    public void showSelectedTool(String nextSelectedTool) {
        showRenderState(renderState.withSelectedTool(nextSelectedTool));
    }

    public void applyEditorSnapshot(DungeonEditorSnapshot editorSnapshot) {
        showRenderState(DungeonMapSnapshotMapper.mapEditor(placeholderTitle, editorSnapshot));
    }

    public void applyTravelSnapshot(TravelDungeonSnapshot travelSnapshot) {
        showRenderState(DungeonMapSnapshotMapper.mapTravel(placeholderTitle, travelSnapshot));
    }

    private void showRenderState(DungeonMapRenderState nextRenderState) {
        renderState = nextRenderState == null ? renderState : nextRenderState;
        mapCanvasContentModel.showRenderScene(SCENE_PROJECTOR.toScene(renderState));
    }

    private static String normalizePlaceholderTitle(String placeholderTitle) {
        return placeholderTitle == null || placeholderTitle.isBlank()
                ? "Dungeon Map"
                : placeholderTitle;
    }

    private record SceneBuckets(
            List<MapCanvasPolygonPrimitive> surfaces,
            List<BoundaryPrimitive> boundaries,
            List<GlyphPrimitive> glyphs,
            List<TextPrimitive> texts,
            List<RelationPrimitive> relations,
            List<MapCanvasPolygonPrimitive> actors,
            List<HitArea> hitAreas
    ) {
    }

    private static final class SceneProjector {

        private final GridSceneAssembler gridSceneAssembler = new GridSceneAssembler();
        private final GraphSceneAssembler graphSceneAssembler = new GraphSceneAssembler();

        private RenderScene toScene(DungeonMapRenderState displayModel) {
            if (displayModel == null) {
                return RenderScene.empty("Dungeon Map");
            }
            SceneBuckets buckets = displayModel.isGraphView()
                    ? graphSceneAssembler.assemble(displayModel)
                    : gridSceneAssembler.assemble(displayModel);
            return new RenderScene(
                    displayModel.title(),
                    displayModel.subtitle(),
                    displayModel.modeLabel(),
                    displayModel.statusLabel(),
                    displayModel.summaryLabel(),
                    displayModel.mapLoaded(),
                    displayModel.overlayMessage(),
                    displayModel.sceneViewMode(),
                    buckets.surfaces(),
                    buckets.boundaries(),
                    buckets.glyphs(),
                    buckets.texts(),
                    buckets.relations(),
                    buckets.actors(),
                    buckets.hitAreas(),
                    List.of());
        }
    }

    private static final class GridSceneAssembler {

        private SceneBuckets assemble(DungeonMapRenderState displayModel) {
            List<MapCanvasPolygonPrimitive> surfaces = new ArrayList<>();
            List<BoundaryPrimitive> boundaries = new ArrayList<>();
            List<GlyphPrimitive> glyphs = new ArrayList<>();
            List<TextPrimitive> texts = new ArrayList<>();
            List<MapCanvasPolygonPrimitive> actors = new ArrayList<>();
            addCells(displayModel, surfaces);
            addEdges(displayModel, boundaries);
            addMarkers(displayModel, glyphs);
            addLabels(displayModel, texts);
            addPartyToken(displayModel, actors);
            return new SceneBuckets(
                    surfaces,
                    boundaries,
                    glyphs,
                    texts,
                    List.of(),
                    actors,
                    HitAreaProjector.gridHitAreas(actors, glyphs, texts, boundaries, surfaces));
        }

        private void addCells(
                DungeonMapRenderState displayModel,
                List<MapCanvasPolygonPrimitive> surfaces
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
                        SurfaceStyler.style(cell, displayModel)));
            }
        }

        private void addEdges(
                DungeonMapRenderState displayModel,
                List<BoundaryPrimitive> boundaries
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
                        EdgeStyler.style(edge, displayModel)));
            }
        }

        private void addMarkers(
                DungeonMapRenderState displayModel,
                List<GlyphPrimitive> glyphs
        ) {
            for (DungeonMapRenderState.Marker marker : displayModel.markers()) {
                if (!LevelFilter.includeLevel(displayModel, marker.z())) {
                    continue;
                }
                glyphs.add(new GlyphPrimitive(
                        SceneIdentity.markerHitRef(marker),
                        SceneIdentity.selectionRef(marker.handle().topologyRef()),
                        marker.z(),
                        SceneGeometry.markerShape(marker),
                        MarkerStyler.style(marker, displayModel),
                        SceneGeometry.abbreviateLabel(marker.label(), marker.isDoorMarker() ? 1 : 3),
                        ScenePalette.LABEL_TEXT));
            }
        }

        private void addLabels(
                DungeonMapRenderState displayModel,
                List<TextPrimitive> texts
        ) {
            for (DungeonMapRenderState.Label label : displayModel.labels()) {
                if (!LevelFilter.includeLevel(displayModel, label.z())) {
                    continue;
                }
                texts.add(new TextPrimitive(
                        SceneIdentity.labelHitRef(label),
                        SceneIdentity.selectionRef(label.topologyRef()),
                        label.z(),
                        label.label(),
                        label.q(),
                        label.r(),
                        SceneGeometry.labelWidthScene(label.label()),
                        SceneGeometry.LABEL_HEIGHT_SCENE,
                        LabelStyler.style(label, displayModel),
                        ScenePalette.LABEL_TEXT));
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
                    SceneGeometry.partyTokenShape(token),
                    new PaintStyle(
                            ScenePalette.PARTY_FILL,
                            ScenePalette.PARTY_STROKE,
                            1.8 / 32.0,
                            1.0,
                            false)));
        }
    }

    private static final class GraphSceneAssembler {

        private SceneBuckets assemble(DungeonMapRenderState displayModel) {
            List<MapCanvasPolygonPrimitive> surfaces = new ArrayList<>();
            List<TextPrimitive> texts = new ArrayList<>();
            List<RelationPrimitive> relations = new ArrayList<>();
            Map<Long, DungeonMapRenderState.GraphNode> nodesById = indexNodes(displayModel.graphNodes());
            addLinks(displayModel, relations, nodesById);
            addNodes(displayModel, surfaces, texts);
            return new SceneBuckets(
                    surfaces,
                    List.of(),
                    List.of(),
                    texts,
                    relations,
                    List.of(),
                    HitAreaProjector.graphHitAreas(texts, relations, surfaces));
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
                List<TextPrimitive> texts
        ) {
            for (DungeonMapRenderState.GraphNode node : displayModel.graphNodes()) {
                surfaces.add(new MapCanvasPolygonPrimitive(
                        SceneIdentity.graphNodeHitRef(node),
                        "ROOM:" + node.id(),
                        displayModel.projectionLevel(),
                        SceneGeometry.roundedRect(node.q(), node.r(), 1.8, 1.1),
                        new PaintStyle(
                                ScenePalette.GRAPH_NODE_FILL,
                                node.selected() ? ScenePalette.HIGHLIGHT_STROKE : ScenePalette.ROOM_CELL_STROKE,
                                node.selected() ? 2.4 / 32.0 : 1.2 / 32.0,
                                1.0,
                                false)));
                texts.add(new TextPrimitive(
                        SceneIdentity.graphNodeHitRef(node),
                        "ROOM:" + node.id(),
                        displayModel.projectionLevel(),
                        node.label(),
                        node.q(),
                        node.r(),
                        Math.max(1.8, SceneGeometry.labelWidthScene(node.label())),
                        SceneGeometry.LABEL_HEIGHT_SCENE,
                        new PaintStyle(null, null, 0.0, 1.0, false),
                        ScenePalette.LABEL_TEXT));
            }
        }
    }

    private static final class HitAreaProjector {

        private static List<HitArea> gridHitAreas(
                List<MapCanvasPolygonPrimitive> actors,
                List<GlyphPrimitive> glyphs,
                List<TextPrimitive> texts,
                List<BoundaryPrimitive> boundaries,
                List<MapCanvasPolygonPrimitive> surfaces
        ) {
            List<HitArea> hitAreas = new ArrayList<>();
            addPolygonHits(hitAreas, actors, MapCanvasPolygonPrimitive::hitRef, MapCanvasPolygonPrimitive::selectionRef,
                    MapCanvasPolygonPrimitive::polygon, MapCanvasViewInputEvent.CanvasPrimitive.ACTOR);
            addPolygonHits(hitAreas, glyphs, GlyphPrimitive::hitRef, GlyphPrimitive::selectionRef,
                    GlyphPrimitive::polygon, MapCanvasViewInputEvent.CanvasPrimitive.GLYPH);
            addTextHits(hitAreas, texts);
            addPolylineHits(hitAreas, boundaries, BoundaryPrimitive::hitRef,
                    BoundaryPrimitive::selectionRef, BoundaryPrimitive::polyline,
                    MapCanvasViewInputEvent.CanvasPrimitive.BOUNDARY);
            addPolygonHits(hitAreas, surfaces, MapCanvasPolygonPrimitive::hitRef, MapCanvasPolygonPrimitive::selectionRef,
                    MapCanvasPolygonPrimitive::polygon, MapCanvasViewInputEvent.CanvasPrimitive.SURFACE);
            return List.copyOf(hitAreas);
        }

        private static List<HitArea> graphHitAreas(
                List<TextPrimitive> texts,
                List<RelationPrimitive> relations,
                List<MapCanvasPolygonPrimitive> surfaces
        ) {
            List<HitArea> hitAreas = new ArrayList<>();
            addTextHits(hitAreas, texts);
            addPolylineHits(hitAreas, relations, RelationPrimitive::hitRef, ignored -> "",
                    RelationPrimitive::polyline, MapCanvasViewInputEvent.CanvasPrimitive.RELATION);
            addPolygonHits(hitAreas, surfaces, MapCanvasPolygonPrimitive::hitRef, MapCanvasPolygonPrimitive::selectionRef,
                    MapCanvasPolygonPrimitive::polygon, MapCanvasViewInputEvent.CanvasPrimitive.SURFACE);
            return List.copyOf(hitAreas);
        }

        private static <T> void addPolygonHits(
                List<HitArea> target,
                List<T> source,
                Function<T, String> hitRefReader,
                Function<T, String> selectionRefReader,
                Function<T, List<MapCanvasPoint>> polygonReader,
                MapCanvasViewInputEvent.CanvasPrimitive primitive
        ) {
            for (T item : source) {
                String hitRef = hitRefReader.apply(item);
                List<MapCanvasPoint> polygon = polygonReader.apply(item);
                if (hitRef.isBlank() || polygon.isEmpty()) {
                    continue;
                }
                target.add(new PolygonHitArea(
                        hitRef,
                        primitive,
                        selectionRefReader.apply(item),
                        polygon));
            }
        }

        private static <T> void addPolylineHits(
                List<HitArea> target,
                List<T> source,
                Function<T, String> hitRefReader,
                Function<T, String> selectionRefReader,
                Function<T, List<MapCanvasPoint>> polylineReader,
                MapCanvasViewInputEvent.CanvasPrimitive primitive
        ) {
            for (T item : source) {
                String hitRef = hitRefReader.apply(item);
                List<MapCanvasPoint> polyline = polylineReader.apply(item);
                if (hitRef.isBlank() || polyline.isEmpty()) {
                    continue;
                }
                target.add(new PolylineHitArea(
                        hitRef,
                        primitive,
                        selectionRefReader.apply(item),
                        polyline));
            }
        }

        private static void addTextHits(
                List<HitArea> target,
                List<TextPrimitive> texts
        ) {
            for (TextPrimitive text : texts) {
                if (text.hitRef().isBlank() || text.text().isBlank()) {
                    continue;
                }
                target.add(new PolygonHitArea(
                        text.hitRef(),
                        MapCanvasViewInputEvent.CanvasPrimitive.TEXT,
                        text.selectionRef(),
                        SceneGeometry.centeredRect(text.centerX(), text.centerY(), text.width(), text.height())));
            }
        }
    }

    private static final class LevelFilter {

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
    }

    private static final class SceneIdentity {

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
    }

    private static final class SceneGeometry {

        private static final double LABEL_HEIGHT_SCENE = 24.0 / 32.0;
        private static final double LABEL_PADDING_SCENE = 16.0 / 32.0;
        private static final double LABEL_CHAR_WIDTH_SCENE = 7.2 / 32.0;
        private static final double MARKER_HALF_SIZE_SCENE = 0.34;
        private static final double PARTY_OUTER_RADIUS_SCENE = 0.26;

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

        private static List<MapCanvasPoint> markerShape(DungeonMapRenderState.Marker marker) {
            double half = marker.isDoorMarker() ? 0.28 : MARKER_HALF_SIZE_SCENE;
            return square(marker.q() - half, marker.r() - half, half * 2.0);
        }

        private static List<MapCanvasPoint> partyTokenShape(DungeonMapRenderState.PartyToken token) {
            double forwardX = token.heading().dx();
            double forwardY = token.heading().dy();
            double sideX = -forwardY;
            double sideY = forwardX;
            return List.of(
                    new MapCanvasPoint(
                            token.q() + forwardX * PARTY_OUTER_RADIUS_SCENE * 1.18,
                            token.r() + forwardY * PARTY_OUTER_RADIUS_SCENE * 1.18),
                    new MapCanvasPoint(
                            token.q() + forwardX * PARTY_OUTER_RADIUS_SCENE * 0.54
                                    + sideX * PARTY_OUTER_RADIUS_SCENE * 0.76,
                            token.r() + forwardY * PARTY_OUTER_RADIUS_SCENE * 0.54
                                    + sideY * PARTY_OUTER_RADIUS_SCENE * 0.76),
                    new MapCanvasPoint(
                            token.q() - forwardX * PARTY_OUTER_RADIUS_SCENE * 0.92
                                    + sideX * PARTY_OUTER_RADIUS_SCENE * 0.92,
                            token.r() - forwardY * PARTY_OUTER_RADIUS_SCENE * 0.92
                                    + sideY * PARTY_OUTER_RADIUS_SCENE * 0.92),
                    new MapCanvasPoint(
                            token.q() - forwardX * PARTY_OUTER_RADIUS_SCENE * 1.02,
                            token.r() - forwardY * PARTY_OUTER_RADIUS_SCENE * 1.02),
                    new MapCanvasPoint(
                            token.q() - forwardX * PARTY_OUTER_RADIUS_SCENE * 0.92
                                    - sideX * PARTY_OUTER_RADIUS_SCENE * 0.92,
                            token.r() - forwardY * PARTY_OUTER_RADIUS_SCENE * 0.92
                                    - sideY * PARTY_OUTER_RADIUS_SCENE * 0.92),
                    new MapCanvasPoint(
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
    }

    private static final class SurfaceStyler {

        private static PaintStyle style(
                DungeonMapRenderState.Cell cell,
                DungeonMapRenderState displayModel
        ) {
            if (cell.preview()) {
                return previewStyle(cell);
            }
            if (cell.z() != displayModel.projectionLevel()) {
                return overlayStyle(cell, displayModel);
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
            SceneColor tint = above ? ScenePalette.ABOVE_TINT : ScenePalette.BELOW_TINT;
            SceneColor baseFill = above ? ScenePalette.ROOM_FILL : ScenePalette.CORRIDOR_FILL;
            return new PaintStyle(
                    ScenePalette.blend(baseFill, tint, 0.56),
                    ScenePalette.blend(ScenePalette.ROOM_CELL_STROKE, tint, 0.62),
                    cell.selected() ? 2.4 / 32.0 : 1.0 / 32.0,
                    SceneGeometry.overlayAlpha(cell.z(), displayModel.projectionLevel(), displayModel.overlaySettings().opacity()),
                    false);
        }

        private static SceneColor baseFill(DungeonMapRenderState.Cell cell) {
            return switch (cell.kind()) {
                case ROOM -> ScenePalette.ROOM_FILL;
                case CORRIDOR -> ScenePalette.CORRIDOR_FILL;
                case STAIR -> ScenePalette.STAIR_FILL;
                case TRANSITION -> ScenePalette.TRANSITION_FILL;
            };
        }

        private static SceneColor baseStroke(DungeonMapRenderState.Cell cell) {
            return switch (cell.kind()) {
                case ROOM -> ScenePalette.ROOM_CELL_STROKE;
                case CORRIDOR, STAIR -> ScenePalette.CORRIDOR_STROKE;
                case TRANSITION -> ScenePalette.TRANSITION_STROKE;
            };
        }
    }

    private static final class EdgeStyler {

        private static PaintStyle style(
                DungeonMapRenderState.Edge edge,
                DungeonMapRenderState displayModel
        ) {
            if (edge.preview()) {
                return new PaintStyle(null, ScenePalette.PREVIEW_STROKE, 2.6 / 32.0, 0.72, true);
            }
            if (edge.z() != displayModel.projectionLevel()) {
                return overlayStyle(edge, displayModel);
            }
            return visibleStyle(edge);
        }

        private static PaintStyle overlayStyle(
                DungeonMapRenderState.Edge edge,
                DungeonMapRenderState displayModel
        ) {
            return new PaintStyle(
                    null,
                    edge.isDoor() ? ScenePalette.DOOR_STROKE : ScenePalette.WALL_STROKE,
                    edge.isDoor() ? 3.6 / 32.0 : 2.0 / 32.0,
                    SceneGeometry.overlayAlpha(edge.z(), displayModel.projectionLevel(), displayModel.overlaySettings().opacity()),
                    false);
        }

        private static PaintStyle visibleStyle(DungeonMapRenderState.Edge edge) {
            SceneColor stroke = edge.isDoor()
                    ? ScenePalette.DOOR_STROKE
                    : edge.selected() ? ScenePalette.HIGHLIGHT_STROKE : ScenePalette.WALL_STROKE;
            double strokeWidth = edge.isDoor() ? 3.6 / 32.0 : edge.selected() ? 2.8 / 32.0 : 2.0 / 32.0;
            return new PaintStyle(null, stroke, strokeWidth, 1.0, false);
        }
    }

    private static final class MarkerStyler {

        private static PaintStyle style(
                DungeonMapRenderState.Marker marker,
                DungeonMapRenderState displayModel
        ) {
            if (marker.preview()) {
                return new PaintStyle(
                        ScenePalette.PREVIEW_FILL,
                        ScenePalette.PREVIEW_STROKE,
                        marker.selected() ? 2.2 / 32.0 : 1.4 / 32.0,
                        0.72,
                        false);
            }
            return new PaintStyle(
                    fill(marker),
                    stroke(marker),
                    marker.selected() ? 2.2 / 32.0 : 1.4 / 32.0,
                    marker.z() == displayModel.projectionLevel()
                            ? 1.0
                            : SceneGeometry.overlayAlpha(
                                    marker.z(),
                                    displayModel.projectionLevel(),
                                    displayModel.overlaySettings().opacity()),
                    false);
        }

        private static SceneColor fill(DungeonMapRenderState.Marker marker) {
            return switch (marker.kind()) {
                case DOOR, CLUSTER -> ScenePalette.LABEL_FILL;
                case STAIR -> ScenePalette.STAIR_FILL;
                case TRANSITION -> ScenePalette.TRANSITION_FILL;
                case WAYPOINT -> ScenePalette.PREVIEW_FILL;
            };
        }

        private static SceneColor stroke(DungeonMapRenderState.Marker marker) {
            if (marker.selected()) {
                return ScenePalette.HIGHLIGHT_STROKE;
            }
            return switch (marker.kind()) {
                case DOOR -> ScenePalette.DOOR_STROKE;
                case STAIR -> ScenePalette.CORRIDOR_STROKE;
                case TRANSITION -> ScenePalette.TRANSITION_STROKE;
                case WAYPOINT -> ScenePalette.PREVIEW_STROKE;
                case CLUSTER -> ScenePalette.LABEL_BORDER;
            };
        }
    }

    private static final class LabelStyler {

        private static PaintStyle style(
                DungeonMapRenderState.Label label,
                DungeonMapRenderState displayModel
        ) {
            return new PaintStyle(
                    label.preview() ? ScenePalette.PREVIEW_FILL : ScenePalette.LABEL_FILL,
                    label.preview()
                            ? ScenePalette.PREVIEW_STROKE
                            : label.selected() ? ScenePalette.HIGHLIGHT_STROKE : ScenePalette.LABEL_BORDER,
                    (label.selected() ? 2.0 : 1.0) / 32.0,
                    alpha(label, displayModel),
                    false);
        }

        private static double alpha(
                DungeonMapRenderState.Label label,
                DungeonMapRenderState displayModel
        ) {
            if (label.z() != displayModel.projectionLevel()) {
                return SceneGeometry.overlayAlpha(
                        label.z(),
                        displayModel.projectionLevel(),
                        displayModel.overlaySettings().opacity());
            }
            return label.preview() ? 0.76 : 1.0;
        }
    }

    private static final class ScenePalette {

        private static final SceneColor ROOM_FILL = color(0x2a, 0x32, 0x38, 1.0);
        private static final SceneColor ROOM_CELL_STROKE = color(0x6d, 0x78, 0x81, 0.72);
        private static final SceneColor WALL_STROKE = color(0x8a, 0x6a, 0x35, 1.0);
        private static final SceneColor HIGHLIGHT_STROKE = color(0xf1, 0xd3, 0x8a, 1.0);
        private static final SceneColor CORRIDOR_FILL = color(0x3b, 0x50, 0x53, 0.8);
        private static final SceneColor CORRIDOR_STROKE = color(0x91, 0xb6, 0xb0, 1.0);
        private static final SceneColor SELECTED_FILL = color(0x58, 0x70, 0x6e, 0.95);
        private static final SceneColor SELECTED_STROKE = color(0xd7, 0xec, 0xe7, 1.0);
        private static final SceneColor PREVIEW_FILL = color(0xd7, 0xec, 0xe7, 0.72);
        private static final SceneColor PREVIEW_STROKE = color(0xf1, 0xd3, 0x8a, 1.0);
        private static final SceneColor PARTY_FILL = color(0xff, 0xb6, 0x2a, 1.0);
        private static final SceneColor PARTY_STROKE = color(0xff, 0xf0, 0xc6, 1.0);
        private static final SceneColor LABEL_FILL = color(0x18, 0x1f, 0x24, 1.0);
        private static final SceneColor LABEL_BORDER = color(0x76, 0x84, 0x8d, 1.0);
        private static final SceneColor LABEL_TEXT = color(0xf2, 0xf4, 0xf5, 1.0);
        private static final SceneColor STAIR_FILL = color(0x4b, 0x3a, 0x6e, 0.95);
        private static final SceneColor TRANSITION_FILL = color(0x6f, 0x3f, 0x28, 0.95);
        private static final SceneColor TRANSITION_STROKE = color(0xe0, 0xa3, 0x6a, 1.0);
        private static final SceneColor DOOR_STROKE = color(0xc6, 0xe2, 0xff, 1.0);
        private static final SceneColor GRAPH_LINK = color(0x88, 0x96, 0xa1, 0.9);
        private static final SceneColor GRAPH_NODE_FILL = color(0x21, 0x29, 0x2f, 1.0);
        private static final SceneColor ABOVE_TINT = color(0x86, 0x90, 0xd8, 0.75);
        private static final SceneColor BELOW_TINT = color(0x55, 0x8a, 0x9c, 0.75);
        private static final SceneColor DESTRUCTIVE_PREVIEW_FILL = color(0x99, 0x43, 0x3d, 1.0);
        private static final SceneColor DESTRUCTIVE_PREVIEW_STROKE = color(0xff, 0xc1, 0x87, 1.0);

        private static SceneColor blend(SceneColor base, SceneColor tint, double weight) {
            return SceneColor.blend(base, tint, weight);
        }

        private static SceneColor color(int red, int green, int blue, double opacity) {
            return SceneColor.color(red, green, blue, opacity);
        }
    }
}
