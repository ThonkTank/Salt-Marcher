package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.ToDoubleFunction;
import java.util.function.ToIntFunction;
import java.util.function.ToLongFunction;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeoneditor.published.DungeonEditorHandleRef;
import src.domain.dungeoneditor.published.DungeonEditorMapProjectionSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorOverlaySettings;
import src.domain.dungeoneditor.published.DungeonEditorSnapshot;
import src.domain.dungeoneditor.published.DungeonEditorTool;
import src.domain.dungeoneditor.published.DungeonEditorViewMode;
import src.domain.travel.published.TravelDungeonMapProjectionSnapshot;
import src.domain.travel.published.TravelDungeonSnapshot;
import src.domain.travel.published.TravelOverlaySettings;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasViewInputEvent;
import static src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel.*;

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

record DungeonMapRenderState(
        String title,
        boolean projectionAvailable,
        int width,
        int height,
        DungeonMapRenderState.Topology topology,
        DungeonMapRenderState.ViewMode viewMode,
        DungeonMapRenderState.LevelOverlaySettings overlaySettings,
        int projectionLevel,
        boolean editorMode,
        String selectedTool,
        String emptyMessage,
        List<DungeonMapRenderState.Cell> cells,
        List<DungeonMapRenderState.Edge> edges,
        List<DungeonMapRenderState.Label> labels,
        List<DungeonMapRenderState.Marker> markers,
        List<DungeonMapRenderState.GraphNode> graphNodes,
        List<DungeonMapRenderState.GraphLink> graphLinks,
        DungeonMapRenderState.PartyToken partyToken
) {

    static final String SELECT_TOOL_LABEL = "Auswahl";
    private static final String EMPTY_KIND = "EMPTY";

    DungeonMapRenderState {
        title = normalizeTitle(title);
        width = Math.max(0, width);
        height = Math.max(0, height);
        topology = topology == null ? Topology.SQUARE : topology;
        viewMode = viewMode == null ? ViewMode.GRID : viewMode;
        overlaySettings = overlaySettings == null ? LevelOverlaySettings.defaults() : overlaySettings;
        selectedTool = normalizeTool(selectedTool);
        emptyMessage = normalizeEmptyMessage(emptyMessage, projectionAvailable);
        cells = immutableList(cells);
        edges = immutableList(edges);
        labels = immutableList(labels);
        markers = immutableList(markers);
        graphNodes = immutableList(graphNodes);
        graphLinks = immutableList(graphLinks);
    }

    String subtitle() {
        if (!projectionAvailable) {
            return "";
        }
        return width + " x " + height + " grid · z=" + projectionLevel;
    }

    String modeLabel() {
        return viewMode.label();
    }

    boolean isGraphView() {
        return viewMode == ViewMode.GRAPH;
    }

    src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel.ViewMode sceneViewMode() {
        return isGraphView()
                ? src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel.ViewMode.graph()
                : src.view.slotcontent.primitives.mapcanvas.MapCanvasContentModel.ViewMode.grid();
    }

    String statusLabel() {
        return editorMode ? selectedTool : "Token auf der Karte ziehen";
    }

    String summaryLabel() {
        if (!projectionAvailable) {
            return "";
        }
        return cells.size() + " cells, " + edges.size() + " edges · " + overlaySettings.mode().label();
    }

    boolean mapLoaded() {
        return !(cells.isEmpty()
                && edges.isEmpty()
                && labels.isEmpty()
                && markers.isEmpty()
                && graphNodes.isEmpty());
    }

    String overlayMessage() {
        return mapLoaded() ? "" : emptyMessage;
    }

    DungeonMapRenderState withViewMode(ViewMode nextViewMode) {
        return new DungeonMapRenderState(
                title,
                projectionAvailable,
                width,
                height,
                topology,
                nextViewMode == null ? ViewMode.GRID : nextViewMode,
                overlaySettings,
                projectionLevel,
                editorMode,
                selectedTool,
                emptyMessage,
                cells,
                edges,
                labels,
                markers,
                graphNodes,
                graphLinks,
                partyToken);
    }

    DungeonMapRenderState withOverlaySettings(LevelOverlaySettings nextOverlaySettings) {
        return new DungeonMapRenderState(
                title,
                projectionAvailable,
                width,
                height,
                topology,
                viewMode,
                nextOverlaySettings == null ? LevelOverlaySettings.off() : nextOverlaySettings,
                projectionLevel,
                editorMode,
                selectedTool,
                emptyMessage,
                cells,
                edges,
                labels,
                markers,
                graphNodes,
                graphLinks,
                partyToken);
    }

    DungeonMapRenderState withProjectionLevel(int nextProjectionLevel) {
        return new DungeonMapRenderState(
                title,
                projectionAvailable,
                width,
                height,
                topology,
                viewMode,
                overlaySettings,
                nextProjectionLevel,
                editorMode,
                selectedTool,
                emptyMessage,
                cells,
                edges,
                labels,
                markers,
                graphNodes,
                graphLinks,
                partyToken);
    }

    DungeonMapRenderState withSelectedTool(String nextSelectedTool) {
        return new DungeonMapRenderState(
                title,
                projectionAvailable,
                width,
                height,
                topology,
                viewMode,
                overlaySettings,
                projectionLevel,
                editorMode,
                normalizeTool(nextSelectedTool),
                emptyMessage,
                cells,
                edges,
                labels,
                markers,
                graphNodes,
                graphLinks,
                partyToken);
    }

    static DungeonMapRenderState empty(String title, boolean editorMode) {
        return new DungeonMapRenderState(
                title,
                false,
                0,
                0,
                Topology.SQUARE,
                ViewMode.GRID,
                LevelOverlaySettings.off(),
                0,
                editorMode,
                SELECT_TOOL_LABEL,
                "No dungeon map loaded.",
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                null);
    }

    enum Topology {
        SQUARE,
        HEX;

        static Topology fromPublished(DungeonTopologyKind topologyKind) {
            return topologyKind == DungeonTopologyKind.HEX ? HEX : SQUARE;
        }
    }

    enum ViewMode {
        GRID("Grid"),
        GRAPH("Graph");

        private final String label;

        ViewMode(String label) {
            this.label = label;
        }

        String label() {
            return label;
        }

        static ViewMode grid() {
            return GRID;
        }

        static ViewMode fromEditor(DungeonEditorViewMode viewMode) {
            return viewMode == DungeonEditorViewMode.GRAPH ? GRAPH : GRID;
        }
    }

    enum OverlayMode {
        OFF("Overlay: Aus"),
        NEARBY("Overlay: Nachbarn"),
        SELECTED("Overlay: Auswahl");

        private final String label;

        OverlayMode(String label) {
            this.label = label;
        }

        String label() {
            return label;
        }

        static OverlayMode fromKey(String modeKey) {
            return switch (upper(modeKey)) {
                case "NEARBY" -> NEARBY;
                case "SELECTED" -> SELECTED;
                default -> OFF;
            };
        }
    }

    enum CellKind {
        ROOM,
        CORRIDOR,
        STAIR,
        TRANSITION;

        static CellKind fromKey(String kindKey) {
            return switch (upper(kindKey)) {
                case "CORRIDOR" -> CORRIDOR;
                case "STAIR" -> STAIR;
                case "TRANSITION" -> TRANSITION;
                default -> ROOM;
            };
        }
    }

    enum EdgeKind {
        WALL,
        DOOR;

        static EdgeKind fromKey(String kindKey) {
            return "DOOR".equalsIgnoreCase(kindKey) ? DOOR : WALL;
        }
    }

    enum MarkerKind {
        DOOR,
        STAIR,
        TRANSITION,
        WAYPOINT,
        CLUSTER;

        static MarkerKind fromKey(String kindKey) {
            return switch (upper(kindKey)) {
                case "STAIR" -> STAIR;
                case "TRANSITION" -> TRANSITION;
                case "WAYPOINT" -> WAYPOINT;
                case "CLUSTER" -> CLUSTER;
                default -> DOOR;
            };
        }
    }

    enum Heading {
        NORTH(0.0, -1.0),
        EAST(1.0, 0.0),
        SOUTH(0.0, 1.0),
        WEST(-1.0, 0.0);

        private final double dx;
        private final double dy;

        Heading(double dx, double dy) {
            this.dx = dx;
            this.dy = dy;
        }

        double dx() {
            return dx;
        }

        double dy() {
            return dy;
        }

        static Heading fromName(String headingName) {
            return switch (upper(headingName)) {
                case "NORTH" -> NORTH;
                case "EAST" -> EAST;
                case "WEST" -> WEST;
                default -> SOUTH;
            };
        }
    }

    record LevelOverlaySettings(
            DungeonMapRenderState.OverlayMode mode,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels
    ) {

        private static final int DEFAULT_LEVEL_RANGE = 2;
        private static final int MAX_LEVEL_RANGE = 6;
        private static final double DEFAULT_OPACITY = 0.35;

        LevelOverlaySettings {
            mode = mode == null ? OverlayMode.OFF : mode;
            levelRange = Math.max(1, Math.min(MAX_LEVEL_RANGE, levelRange));
            opacity = Math.max(0.05, Math.min(0.95, opacity));
            selectedLevels = selectedLevels == null
                    ? List.of()
                    : selectedLevels.stream()
                            .filter(Objects::nonNull)
                            .distinct()
                            .sorted()
                            .toList();
        }

        @Override
        public List<Integer> selectedLevels() {
            return immutableList(selectedLevels);
        }

        boolean selectsLevel(int level) {
            return selectedLevels().contains(level);
        }

        static LevelOverlaySettings defaults() {
            return new LevelOverlaySettings(OverlayMode.NEARBY, DEFAULT_LEVEL_RANGE, DEFAULT_OPACITY, List.of());
        }

        static LevelOverlaySettings off() {
            return new LevelOverlaySettings(OverlayMode.OFF, DEFAULT_LEVEL_RANGE, DEFAULT_OPACITY, List.of());
        }
    }

    record TopologyRef(String kind, long id) {

        TopologyRef {
            kind = kind == null || kind.isBlank() ? EMPTY_KIND : kind.trim();
            id = Math.max(0L, id);
        }

        boolean isEmpty() {
            return id <= 0L || EMPTY_KIND.equals(kind);
        }

        static TopologyRef empty() {
            return new TopologyRef(EMPTY_KIND, 0L);
        }
    }

    record MarkerHandle(
            String kind,
            DungeonMapRenderState.TopologyRef topologyRef,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int index,
            int q,
            int r,
            int level,
            String direction
    ) {

        MarkerHandle {
            kind = kind == null || kind.isBlank() ? EMPTY_KIND : kind.trim();
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            corridorId = Math.max(0L, corridorId);
            roomId = Math.max(0L, roomId);
            index = Math.max(0, index);
            direction = direction == null ? "" : direction.trim();
        }
    }

    record Cell(
            int q,
            int r,
            int z,
            String label,
            DungeonMapRenderState.CellKind kind,
            long ownerId,
            long clusterId,
            DungeonMapRenderState.TopologyRef topologyRef,
            boolean selected,
            boolean overlay,
            boolean preview,
            boolean destructivePreview
    ) {

        Cell {
            label = label == null ? "" : label;
            kind = kind == null ? CellKind.ROOM : kind;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }
    }

    record Edge(
            double startQ,
            double startR,
            double endQ,
            double endR,
            int z,
            DungeonMapRenderState.EdgeKind kind,
            String label,
            long ownerId,
            DungeonMapRenderState.TopologyRef topologyRef,
            boolean selected,
            boolean preview
    ) {

        Edge {
            kind = kind == null ? EdgeKind.WALL : kind;
            label = label == null ? "" : label;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }

        boolean isDoor() {
            return kind == EdgeKind.DOOR;
        }
    }

    record Label(
            String label,
            double q,
            double r,
            int z,
            long ownerId,
            long clusterId,
            DungeonMapRenderState.TopologyRef topologyRef,
            boolean selected,
            boolean preview
    ) {

        Label {
            label = label == null ? "" : label;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
        }
    }

    record Marker(
            String label,
            double q,
            double r,
            int z,
            DungeonMapRenderState.MarkerKind kind,
            boolean selected,
            DungeonMapRenderState.MarkerHandle handle,
            boolean preview
    ) {

        Marker {
            label = label == null ? "" : label;
            kind = kind == null ? MarkerKind.DOOR : kind;
            handle = handle == null
                    ? new MarkerHandle(EMPTY_KIND, TopologyRef.empty(), 0L, 0L, 0L, 0L, 0, 0, 0, 0, "")
                    : handle;
        }

        boolean isDoorMarker() {
            return kind == MarkerKind.DOOR;
        }
    }

    record GraphNode(long id, long clusterId, String label, double q, double r, boolean selected) {

        GraphNode {
            label = label == null || label.isBlank() ? "Room" : label;
        }
    }

    record GraphLink(long fromId, long toId, boolean selected) {
    }

    record PartyToken(double q, double r, int z, DungeonMapRenderState.Heading heading, boolean visible) {

        PartyToken {
            heading = heading == null ? Heading.SOUTH : heading;
        }
    }

    private static String normalizeTitle(String title) {
        return title == null || title.isBlank() ? "Dungeon Map" : title.trim();
    }

    private static String normalizeTool(String selectedTool) {
        return selectedTool == null || selectedTool.isBlank() ? SELECT_TOOL_LABEL : selectedTool;
    }

    private static String normalizeEmptyMessage(String emptyMessage, boolean projectionAvailable) {
        if (emptyMessage != null && !emptyMessage.isBlank()) {
            return emptyMessage;
        }
        return projectionAvailable ? "No dungeon map geometry available." : "No dungeon map loaded.";
    }

    private static <T> List<T> immutableList(@Nullable List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static String upper(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}

final class DungeonMapSnapshotMapper {

    private static final Map<DungeonEditorTool, String> TOOL_LABELS = createToolLabels();

    private DungeonMapSnapshotMapper() {
    }

    static DungeonMapRenderState mapEditor(String placeholderTitle, DungeonEditorSnapshot snapshot) {
        DungeonEditorSnapshot safeSnapshot = snapshot == null
                ? DungeonEditorSnapshot.empty("")
                : snapshot;
        DungeonMapRenderState baseState = mapProjection(
                placeholderTitle,
                safeSnapshot.mapProjection(),
                true,
                DungeonMapEditorProjectionAccess.ACCESS);
        return baseState.withViewMode(DungeonMapRenderState.ViewMode.fromEditor(safeSnapshot.viewMode()))
                .withOverlaySettings(toOverlaySettings(safeSnapshot.overlaySettings()))
                .withProjectionLevel(safeSnapshot.projectionLevel())
                .withSelectedTool(toolLabel(safeSnapshot.selectedTool()));
    }

    static DungeonMapRenderState mapTravel(String placeholderTitle, TravelDungeonSnapshot snapshot) {
        TravelDungeonSnapshot safeSnapshot = snapshot == null
                ? TravelDungeonSnapshot.empty()
                : snapshot;
        DungeonMapRenderState baseState = mapProjection(
                placeholderTitle,
                safeSnapshot.mapProjection(),
                false,
                DungeonMapTravelProjectionAccess.ACCESS);
        return baseState.withOverlaySettings(toOverlaySettings(safeSnapshot.overlaySettings()))
                .withProjectionLevel(safeSnapshot.projectionLevel())
                .withSelectedTool(DungeonMapRenderState.SELECT_TOOL_LABEL);
    }

    private static <P, C, E, L, M, N, G, T> DungeonMapRenderState mapProjection(
            String placeholderTitle,
            @Nullable P projection,
            boolean editorMode,
            DungeonMapProjectionElements.ProjectionAccess<P, C, E, L, M, N, G, T> access
    ) {
        if (projection == null) {
            return DungeonMapRenderState.empty(placeholderTitle, editorMode);
        }
        return new DungeonMapRenderState(
                access.mapName().apply(projection),
                true,
                Math.max(1, access.width().applyAsInt(projection)),
                Math.max(1, access.height().applyAsInt(projection)),
                access.topology().apply(projection),
                DungeonMapRenderState.ViewMode.grid(),
                DungeonMapRenderState.LevelOverlaySettings.off(),
                0,
                editorMode,
                DungeonMapRenderState.SELECT_TOOL_LABEL,
                "No dungeon map geometry available.",
                DungeonMapProjectionElements.mapCells(access.cells().apply(projection), access.cellReader()),
                DungeonMapProjectionElements.mapEdges(access.edges().apply(projection), access.edgeReader()),
                DungeonMapProjectionElements.mapLabels(access.labels().apply(projection), access.labelReader()),
                DungeonMapProjectionElements.mapMarkers(access.markers().apply(projection), access.markerReader()),
                DungeonMapProjectionElements.mapGraphNodes(access.graphNodes().apply(projection), access.graphNodeReader()),
                DungeonMapProjectionElements.mapGraphLinks(access.graphLinks().apply(projection), access.graphLinkReader()),
                DungeonMapProjectionElements.mapPartyToken(
                        access.partyToken().apply(projection),
                        access.partyTokenReader()));
    }

    private static DungeonMapRenderState.LevelOverlaySettings toOverlaySettings(
            DungeonEditorOverlaySettings overlaySettings
    ) {
        DungeonEditorOverlaySettings safeOverlay = overlaySettings == null
                ? DungeonEditorOverlaySettings.defaults()
                : overlaySettings;
        return new DungeonMapRenderState.LevelOverlaySettings(
                DungeonMapRenderState.OverlayMode.fromKey(safeOverlay.modeKey()),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static DungeonMapRenderState.LevelOverlaySettings toOverlaySettings(
            TravelOverlaySettings overlaySettings
    ) {
        TravelOverlaySettings safeOverlay = overlaySettings == null
                ? TravelOverlaySettings.defaults()
                : overlaySettings;
        return new DungeonMapRenderState.LevelOverlaySettings(
                DungeonMapRenderState.OverlayMode.fromKey(safeOverlay.modeKey()),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static String toolLabel(DungeonEditorTool selectedTool) {
        return TOOL_LABELS.getOrDefault(selectedTool, DungeonMapRenderState.SELECT_TOOL_LABEL);
    }

    private static Map<DungeonEditorTool, String> createToolLabels() {
        Map<DungeonEditorTool, String> labels = new EnumMap<>(DungeonEditorTool.class);
        labels.put(DungeonEditorTool.SELECT, DungeonMapRenderState.SELECT_TOOL_LABEL);
        labels.put(DungeonEditorTool.ROOM_PAINT, "Raum malen");
        labels.put(DungeonEditorTool.ROOM_DELETE, "Raum löschen");
        labels.put(DungeonEditorTool.WALL_CREATE, "Wand setzen");
        labels.put(DungeonEditorTool.WALL_DELETE, "Wand löschen");
        labels.put(DungeonEditorTool.DOOR_CREATE, "Tür setzen");
        labels.put(DungeonEditorTool.DOOR_DELETE, "Tür löschen");
        labels.put(DungeonEditorTool.CORRIDOR_CREATE, "Korridor erstellen");
        labels.put(DungeonEditorTool.CORRIDOR_DELETE, "Korridor löschen");
        labels.put(DungeonEditorTool.STAIR_CREATE, "Treppe erstellen");
        labels.put(DungeonEditorTool.STAIR_DELETE, "Treppe löschen");
        labels.put(DungeonEditorTool.TRANSITION_CREATE, "Übergang erstellen");
        labels.put(DungeonEditorTool.TRANSITION_DELETE, "Übergang löschen");
        return labels;
    }
}

final class DungeonMapProjectionElements {

    private DungeonMapProjectionElements() {
    }

    static <T> List<DungeonMapRenderState.Cell> mapCells(
            List<T> cells,
            DungeonMapProjectionElements.CellReader<T> reader
    ) {
        List<DungeonMapRenderState.Cell> mapped = new ArrayList<>(cells.size());
        for (T cell : cells) {
            mapped.add(new DungeonMapRenderState.Cell(
                    reader.q().applyAsInt(cell),
                    reader.r().applyAsInt(cell),
                    reader.level().applyAsInt(cell),
                    reader.label().apply(cell),
                    DungeonMapRenderState.CellKind.fromKey(reader.kindKey().apply(cell)),
                    reader.ownerId().applyAsLong(cell),
                    reader.clusterId().applyAsLong(cell),
                    new DungeonMapRenderState.TopologyRef(
                            reader.topologyKind().apply(cell),
                            reader.topologyId().applyAsLong(cell)),
                    reader.selected().test(cell),
                    reader.overlay().test(cell),
                    reader.preview().test(cell),
                    reader.destructivePreview().test(cell)));
        }
        return List.copyOf(mapped);
    }

    static <T> List<DungeonMapRenderState.Edge> mapEdges(
            List<T> edges,
            DungeonMapProjectionElements.EdgeReader<T> reader
    ) {
        List<DungeonMapRenderState.Edge> mapped = new ArrayList<>(edges.size());
        for (T edge : edges) {
            mapped.add(new DungeonMapRenderState.Edge(
                    reader.startQ().applyAsDouble(edge),
                    reader.startR().applyAsDouble(edge),
                    reader.endQ().applyAsDouble(edge),
                    reader.endR().applyAsDouble(edge),
                    reader.level().applyAsInt(edge),
                    DungeonMapRenderState.EdgeKind.fromKey(reader.kindKey().apply(edge)),
                    reader.label().apply(edge),
                    reader.ownerId().applyAsLong(edge),
                    new DungeonMapRenderState.TopologyRef(
                            reader.topologyKind().apply(edge),
                            reader.topologyId().applyAsLong(edge)),
                    reader.selected().test(edge),
                    reader.preview().test(edge)));
        }
        return List.copyOf(mapped);
    }

    static <T> List<DungeonMapRenderState.Label> mapLabels(
            List<T> labels,
            DungeonMapProjectionElements.LabelReader<T> reader
    ) {
        List<DungeonMapRenderState.Label> mapped = new ArrayList<>(labels.size());
        for (T label : labels) {
            mapped.add(new DungeonMapRenderState.Label(
                    reader.label().apply(label),
                    reader.q().applyAsDouble(label),
                    reader.r().applyAsDouble(label),
                    reader.level().applyAsInt(label),
                    reader.ownerId().applyAsLong(label),
                    reader.clusterId().applyAsLong(label),
                    new DungeonMapRenderState.TopologyRef(
                            reader.topologyKind().apply(label),
                            reader.topologyId().applyAsLong(label)),
                    reader.selected().test(label),
                    reader.preview().test(label)));
        }
        return List.copyOf(mapped);
    }

    static <T, H> List<DungeonMapRenderState.Marker> mapMarkers(
            List<T> markers,
            DungeonMapProjectionElements.MarkerReader<T, H> reader
    ) {
        List<DungeonMapRenderState.Marker> mapped = new ArrayList<>(markers.size());
        for (T marker : markers) {
            H handle = reader.handle().apply(marker);
            mapped.add(new DungeonMapRenderState.Marker(
                    reader.label().apply(marker),
                    reader.q().applyAsDouble(marker),
                    reader.r().applyAsDouble(marker),
                    reader.level().applyAsInt(marker),
                    DungeonMapRenderState.MarkerKind.fromKey(reader.kindKey().apply(marker)),
                    reader.selected().test(marker),
                    new DungeonMapRenderState.MarkerHandle(
                            reader.handleReader().kind().apply(handle),
                            new DungeonMapRenderState.TopologyRef(
                                    reader.handleReader().topologyKind().apply(handle),
                                    reader.handleReader().topologyId().applyAsLong(handle)),
                            reader.handleReader().ownerId().applyAsLong(handle),
                            reader.handleReader().clusterId().applyAsLong(handle),
                            reader.handleReader().corridorId().applyAsLong(handle),
                            reader.handleReader().roomId().applyAsLong(handle),
                            reader.handleReader().index().applyAsInt(handle),
                            reader.handleReader().q().applyAsInt(handle),
                            reader.handleReader().r().applyAsInt(handle),
                            reader.handleReader().level().applyAsInt(handle),
                            reader.handleReader().direction().apply(handle)),
                    reader.preview().test(marker)));
        }
        return List.copyOf(mapped);
    }

    static <T> List<DungeonMapRenderState.GraphNode> mapGraphNodes(
            List<T> nodes,
            DungeonMapProjectionElements.GraphNodeReader<T> reader
    ) {
        List<DungeonMapRenderState.GraphNode> mapped = new ArrayList<>(nodes.size());
        for (T node : nodes) {
            mapped.add(new DungeonMapRenderState.GraphNode(
                    reader.id().applyAsLong(node),
                    reader.clusterId().applyAsLong(node),
                    reader.label().apply(node),
                    reader.q().applyAsDouble(node),
                    reader.r().applyAsDouble(node),
                    reader.selected().test(node)));
        }
        return List.copyOf(mapped);
    }

    static <T> List<DungeonMapRenderState.GraphLink> mapGraphLinks(
            List<T> links,
            DungeonMapProjectionElements.GraphLinkReader<T> reader
    ) {
        List<DungeonMapRenderState.GraphLink> mapped = new ArrayList<>(links.size());
        for (T link : links) {
            mapped.add(new DungeonMapRenderState.GraphLink(
                    reader.fromId().applyAsLong(link),
                    reader.toId().applyAsLong(link),
                    reader.selected().test(link)));
        }
        return List.copyOf(mapped);
    }

    static <T> DungeonMapRenderState.PartyToken mapPartyToken(
            @Nullable T token,
            DungeonMapProjectionElements.PartyTokenReader<T> reader
    ) {
        if (token == null || reader == null) {
            return null;
        }
        return new DungeonMapRenderState.PartyToken(
                reader.q().applyAsDouble(token),
                reader.r().applyAsDouble(token),
                reader.level().applyAsInt(token),
                DungeonMapRenderState.Heading.fromName(reader.headingName().apply(token)),
                reader.visible().test(token));
    }

    record ProjectionAccess<P, C, E, L, M, N, G, T>(
            Function<P, String> mapName,
            ToIntFunction<P> width,
            ToIntFunction<P> height,
            Function<P, DungeonMapRenderState.Topology> topology,
            Function<P, List<C>> cells,
            DungeonMapProjectionElements.CellReader<C> cellReader,
            Function<P, List<E>> edges,
            DungeonMapProjectionElements.EdgeReader<E> edgeReader,
            Function<P, List<L>> labels,
            DungeonMapProjectionElements.LabelReader<L> labelReader,
            Function<P, List<M>> markers,
            DungeonMapProjectionElements.MarkerReader<M, ?> markerReader,
            Function<P, List<N>> graphNodes,
            DungeonMapProjectionElements.GraphNodeReader<N> graphNodeReader,
            Function<P, List<G>> graphLinks,
            DungeonMapProjectionElements.GraphLinkReader<G> graphLinkReader,
            Function<P, T> partyToken,
            DungeonMapProjectionElements.PartyTokenReader<T> partyTokenReader
    ) {
    }

    record CellReader<T>(
            ToIntFunction<T> q,
            ToIntFunction<T> r,
            ToIntFunction<T> level,
            Function<T, String> label,
            Function<T, String> kindKey,
            ToLongFunction<T> ownerId,
            ToLongFunction<T> clusterId,
            Function<T, String> topologyKind,
            ToLongFunction<T> topologyId,
            Predicate<T> selected,
            Predicate<T> overlay,
            Predicate<T> preview,
            Predicate<T> destructivePreview
    ) {
    }

    record EdgeReader<T>(
            ToDoubleFunction<T> startQ,
            ToDoubleFunction<T> startR,
            ToDoubleFunction<T> endQ,
            ToDoubleFunction<T> endR,
            ToIntFunction<T> level,
            Function<T, String> kindKey,
            Function<T, String> label,
            ToLongFunction<T> ownerId,
            Function<T, String> topologyKind,
            ToLongFunction<T> topologyId,
            Predicate<T> selected,
            Predicate<T> preview
    ) {
    }

    record LabelReader<T>(
            Function<T, String> label,
            ToDoubleFunction<T> q,
            ToDoubleFunction<T> r,
            ToIntFunction<T> level,
            ToLongFunction<T> ownerId,
            ToLongFunction<T> clusterId,
            Function<T, String> topologyKind,
            ToLongFunction<T> topologyId,
            Predicate<T> selected,
            Predicate<T> preview
    ) {
    }

    record MarkerReader<T, H>(
            Function<T, String> label,
            ToDoubleFunction<T> q,
            ToDoubleFunction<T> r,
            ToIntFunction<T> level,
            Function<T, String> kindKey,
            Predicate<T> selected,
            Function<T, H> handle,
            DungeonMapProjectionElements.MarkerHandleReader<H> handleReader,
            Predicate<T> preview
    ) {
    }

    record MarkerHandleReader<T>(
            Function<T, String> kind,
            Function<T, String> topologyKind,
            ToLongFunction<T> topologyId,
            ToLongFunction<T> ownerId,
            ToLongFunction<T> clusterId,
            ToLongFunction<T> corridorId,
            ToLongFunction<T> roomId,
            ToIntFunction<T> index,
            ToIntFunction<T> q,
            ToIntFunction<T> r,
            ToIntFunction<T> level,
            Function<T, String> direction
    ) {
    }

    record GraphNodeReader<T>(
            ToLongFunction<T> id,
            ToLongFunction<T> clusterId,
            Function<T, String> label,
            ToDoubleFunction<T> q,
            ToDoubleFunction<T> r,
            Predicate<T> selected
    ) {
    }

    record GraphLinkReader<T>(
            ToLongFunction<T> fromId,
            ToLongFunction<T> toId,
            Predicate<T> selected
    ) {
    }

    record PartyTokenReader<T>(
            ToDoubleFunction<T> q,
            ToDoubleFunction<T> r,
            ToIntFunction<T> level,
            Function<T, String> headingName,
            Predicate<T> visible
    ) {
    }
}

final class DungeonMapEditorProjectionAccess {

    static final DungeonMapProjectionElements.ProjectionAccess<
            DungeonEditorMapProjectionSnapshot,
            DungeonEditorMapProjectionSnapshot.CellProjection,
            DungeonEditorMapProjectionSnapshot.EdgeProjection,
            DungeonEditorMapProjectionSnapshot.LabelProjection,
            DungeonEditorMapProjectionSnapshot.MarkerProjection,
            DungeonEditorMapProjectionSnapshot.GraphNodeProjection,
            DungeonEditorMapProjectionSnapshot.GraphLinkProjection,
            DungeonEditorMapProjectionSnapshot.PartyTokenProjection> ACCESS =
            new DungeonMapProjectionElements.ProjectionAccess<>(
                    DungeonEditorMapProjectionSnapshot::mapName,
                    DungeonEditorMapProjectionSnapshot::width,
                    DungeonEditorMapProjectionSnapshot::height,
                    projection -> DungeonMapRenderState.Topology.fromPublished(projection.topology()),
                    DungeonEditorMapProjectionSnapshot::cells,
                    new DungeonMapProjectionElements.CellReader<>(
                            DungeonEditorMapProjectionSnapshot.CellProjection::q,
                            DungeonEditorMapProjectionSnapshot.CellProjection::r,
                            DungeonEditorMapProjectionSnapshot.CellProjection::level,
                            DungeonEditorMapProjectionSnapshot.CellProjection::label,
                            cell -> cell.kind().name(),
                            DungeonEditorMapProjectionSnapshot.CellProjection::ownerId,
                            DungeonEditorMapProjectionSnapshot.CellProjection::clusterId,
                            cell -> cell.topologyRef().kind(),
                            cell -> cell.topologyRef().id(),
                            DungeonEditorMapProjectionSnapshot.CellProjection::selected,
                            DungeonEditorMapProjectionSnapshot.CellProjection::overlay,
                            DungeonEditorMapProjectionSnapshot.CellProjection::preview,
                            DungeonEditorMapProjectionSnapshot.CellProjection::destructivePreview),
                    DungeonEditorMapProjectionSnapshot::edges,
                    new DungeonMapProjectionElements.EdgeReader<>(
                            DungeonEditorMapProjectionSnapshot.EdgeProjection::startQ,
                            DungeonEditorMapProjectionSnapshot.EdgeProjection::startR,
                            DungeonEditorMapProjectionSnapshot.EdgeProjection::endQ,
                            DungeonEditorMapProjectionSnapshot.EdgeProjection::endR,
                            DungeonEditorMapProjectionSnapshot.EdgeProjection::level,
                            edge -> edge.kind().name(),
                            DungeonEditorMapProjectionSnapshot.EdgeProjection::label,
                            DungeonEditorMapProjectionSnapshot.EdgeProjection::ownerId,
                            edge -> edge.topologyRef().kind(),
                            edge -> edge.topologyRef().id(),
                            DungeonEditorMapProjectionSnapshot.EdgeProjection::selected,
                            DungeonEditorMapProjectionSnapshot.EdgeProjection::preview),
                    DungeonEditorMapProjectionSnapshot::labels,
                    new DungeonMapProjectionElements.LabelReader<>(
                            DungeonEditorMapProjectionSnapshot.LabelProjection::label,
                            DungeonEditorMapProjectionSnapshot.LabelProjection::q,
                            DungeonEditorMapProjectionSnapshot.LabelProjection::r,
                            DungeonEditorMapProjectionSnapshot.LabelProjection::level,
                            DungeonEditorMapProjectionSnapshot.LabelProjection::ownerId,
                            DungeonEditorMapProjectionSnapshot.LabelProjection::clusterId,
                            label -> label.topologyRef().kind(),
                            label -> label.topologyRef().id(),
                            DungeonEditorMapProjectionSnapshot.LabelProjection::selected,
                            DungeonEditorMapProjectionSnapshot.LabelProjection::preview),
                    DungeonEditorMapProjectionSnapshot::markers,
                    new DungeonMapProjectionElements.MarkerReader<>(
                            DungeonEditorMapProjectionSnapshot.MarkerProjection::label,
                            DungeonEditorMapProjectionSnapshot.MarkerProjection::q,
                            DungeonEditorMapProjectionSnapshot.MarkerProjection::r,
                            DungeonEditorMapProjectionSnapshot.MarkerProjection::level,
                            marker -> marker.kind().name(),
                            DungeonEditorMapProjectionSnapshot.MarkerProjection::selected,
                            DungeonEditorMapProjectionSnapshot.MarkerProjection::handleRef,
                            new DungeonMapProjectionElements.MarkerHandleReader<>(
                                    DungeonEditorHandleRef::kind,
                                    handle -> handle.topologyRef().kind(),
                                    handle -> handle.topologyRef().id(),
                                    DungeonEditorHandleRef::ownerId,
                                    DungeonEditorHandleRef::clusterId,
                                    DungeonEditorHandleRef::corridorId,
                                    DungeonEditorHandleRef::roomId,
                                    DungeonEditorHandleRef::index,
                                    handle -> handle.cell().q(),
                                    handle -> handle.cell().r(),
                                    handle -> handle.cell().level(),
                                    DungeonEditorHandleRef::direction),
                            DungeonEditorMapProjectionSnapshot.MarkerProjection::preview),
                    DungeonEditorMapProjectionSnapshot::graphNodes,
                    new DungeonMapProjectionElements.GraphNodeReader<>(
                            DungeonEditorMapProjectionSnapshot.GraphNodeProjection::id,
                            DungeonEditorMapProjectionSnapshot.GraphNodeProjection::clusterId,
                            DungeonEditorMapProjectionSnapshot.GraphNodeProjection::label,
                            DungeonEditorMapProjectionSnapshot.GraphNodeProjection::q,
                            DungeonEditorMapProjectionSnapshot.GraphNodeProjection::r,
                            DungeonEditorMapProjectionSnapshot.GraphNodeProjection::selected),
                    DungeonEditorMapProjectionSnapshot::graphLinks,
                    new DungeonMapProjectionElements.GraphLinkReader<>(
                            DungeonEditorMapProjectionSnapshot.GraphLinkProjection::fromId,
                            DungeonEditorMapProjectionSnapshot.GraphLinkProjection::toId,
                            DungeonEditorMapProjectionSnapshot.GraphLinkProjection::selected),
                    ignored -> null,
                    null);

    private DungeonMapEditorProjectionAccess() {
    }
}

final class DungeonMapTravelProjectionAccess {

    static final DungeonMapProjectionElements.ProjectionAccess<
            TravelDungeonMapProjectionSnapshot,
            TravelDungeonMapProjectionSnapshot.CellProjection,
            TravelDungeonMapProjectionSnapshot.EdgeProjection,
            TravelDungeonMapProjectionSnapshot.LabelProjection,
            TravelDungeonMapProjectionSnapshot.MarkerProjection,
            TravelDungeonMapProjectionSnapshot.GraphNodeProjection,
            TravelDungeonMapProjectionSnapshot.GraphLinkProjection,
            TravelDungeonMapProjectionSnapshot.PartyTokenProjection> ACCESS =
            new DungeonMapProjectionElements.ProjectionAccess<>(
                    TravelDungeonMapProjectionSnapshot::mapName,
                    TravelDungeonMapProjectionSnapshot::width,
                    TravelDungeonMapProjectionSnapshot::height,
                    projection -> DungeonMapRenderState.Topology.fromPublished(projection.topology()),
                    projection -> projection.content().cells(),
                    new DungeonMapProjectionElements.CellReader<>(
                            TravelDungeonMapProjectionSnapshot.CellProjection::q,
                            TravelDungeonMapProjectionSnapshot.CellProjection::r,
                            TravelDungeonMapProjectionSnapshot.CellProjection::level,
                            TravelDungeonMapProjectionSnapshot.CellProjection::label,
                            cell -> cell.kind().name(),
                            TravelDungeonMapProjectionSnapshot.CellProjection::ownerId,
                            TravelDungeonMapProjectionSnapshot.CellProjection::clusterId,
                            cell -> cell.topologyRef().kind(),
                            cell -> cell.topologyRef().id(),
                            TravelDungeonMapProjectionSnapshot.CellProjection::selected,
                            TravelDungeonMapProjectionSnapshot.CellProjection::overlay,
                            TravelDungeonMapProjectionSnapshot.CellProjection::preview,
                            TravelDungeonMapProjectionSnapshot.CellProjection::destructivePreview),
                    projection -> projection.content().edges(),
                    new DungeonMapProjectionElements.EdgeReader<>(
                            TravelDungeonMapProjectionSnapshot.EdgeProjection::startQ,
                            TravelDungeonMapProjectionSnapshot.EdgeProjection::startR,
                            TravelDungeonMapProjectionSnapshot.EdgeProjection::endQ,
                            TravelDungeonMapProjectionSnapshot.EdgeProjection::endR,
                            TravelDungeonMapProjectionSnapshot.EdgeProjection::level,
                            edge -> edge.kind().name(),
                            TravelDungeonMapProjectionSnapshot.EdgeProjection::label,
                            TravelDungeonMapProjectionSnapshot.EdgeProjection::ownerId,
                            edge -> edge.topologyRef().kind(),
                            edge -> edge.topologyRef().id(),
                            TravelDungeonMapProjectionSnapshot.EdgeProjection::selected,
                            TravelDungeonMapProjectionSnapshot.EdgeProjection::preview),
                    projection -> projection.content().labels(),
                    new DungeonMapProjectionElements.LabelReader<>(
                            TravelDungeonMapProjectionSnapshot.LabelProjection::label,
                            TravelDungeonMapProjectionSnapshot.LabelProjection::q,
                            TravelDungeonMapProjectionSnapshot.LabelProjection::r,
                            TravelDungeonMapProjectionSnapshot.LabelProjection::level,
                            TravelDungeonMapProjectionSnapshot.LabelProjection::ownerId,
                            TravelDungeonMapProjectionSnapshot.LabelProjection::clusterId,
                            label -> label.topologyRef().kind(),
                            label -> label.topologyRef().id(),
                            TravelDungeonMapProjectionSnapshot.LabelProjection::selected,
                            TravelDungeonMapProjectionSnapshot.LabelProjection::preview),
                    projection -> projection.content().markers(),
                    new DungeonMapProjectionElements.MarkerReader<>(
                            TravelDungeonMapProjectionSnapshot.MarkerProjection::label,
                            TravelDungeonMapProjectionSnapshot.MarkerProjection::q,
                            TravelDungeonMapProjectionSnapshot.MarkerProjection::r,
                            TravelDungeonMapProjectionSnapshot.MarkerProjection::level,
                            marker -> marker.kind().name(),
                            TravelDungeonMapProjectionSnapshot.MarkerProjection::selected,
                            TravelDungeonMapProjectionSnapshot.MarkerProjection::handle,
                            new DungeonMapProjectionElements.MarkerHandleReader<>(
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::kind,
                                    handle -> handle.topologyRef().kind(),
                                    handle -> handle.topologyRef().id(),
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::ownerId,
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::clusterId,
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::corridorId,
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::roomId,
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::index,
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::q,
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::r,
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::level,
                                    TravelDungeonMapProjectionSnapshot.MarkerHandle::direction),
                            TravelDungeonMapProjectionSnapshot.MarkerProjection::preview),
                    projection -> projection.content().graphNodes(),
                    new DungeonMapProjectionElements.GraphNodeReader<>(
                            TravelDungeonMapProjectionSnapshot.GraphNodeProjection::id,
                            TravelDungeonMapProjectionSnapshot.GraphNodeProjection::clusterId,
                            TravelDungeonMapProjectionSnapshot.GraphNodeProjection::label,
                            TravelDungeonMapProjectionSnapshot.GraphNodeProjection::q,
                            TravelDungeonMapProjectionSnapshot.GraphNodeProjection::r,
                            TravelDungeonMapProjectionSnapshot.GraphNodeProjection::selected),
                    projection -> projection.content().graphLinks(),
                    new DungeonMapProjectionElements.GraphLinkReader<>(
                            TravelDungeonMapProjectionSnapshot.GraphLinkProjection::fromId,
                            TravelDungeonMapProjectionSnapshot.GraphLinkProjection::toId,
                            TravelDungeonMapProjectionSnapshot.GraphLinkProjection::selected),
                    TravelDungeonMapProjectionSnapshot::partyToken,
                    new DungeonMapProjectionElements.PartyTokenReader<>(
                            TravelDungeonMapProjectionSnapshot.PartyTokenProjection::q,
                            TravelDungeonMapProjectionSnapshot.PartyTokenProjection::r,
                            TravelDungeonMapProjectionSnapshot.PartyTokenProjection::level,
                            token -> token.heading().name(),
                            TravelDungeonMapProjectionSnapshot.PartyTokenProjection::visible));

    private DungeonMapTravelProjectionAccess() {
    }
}
