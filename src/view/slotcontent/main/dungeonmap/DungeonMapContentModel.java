package src.view.slotcontent.main.dungeonmap;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import javafx.beans.property.ReadOnlyDoubleProperty;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.domain.dungeon.published.TravelDungeonSnapshot;

public final class DungeonMapContentModel {

    private static final String EMPTY_KIND = "EMPTY";
    private static final String EMPTY_LABEL_KIND = EMPTY_KIND;
    private static final String SYNTHETIC_HOVER_NONE_KIND = "NONE";
    static final String ROOM_LABEL_KIND = "ROOM_LABEL";
    static final String CLUSTER_LABEL_KIND = "CLUSTER_LABEL";
    static final String FEATURE_LABEL_KIND = "FEATURE_LABEL";
    private static final String WALL_KIND = "WALL";

    private final String placeholderTitle;
    private final ReadOnlyObjectWrapper<CanvasState> canvasState;
    private final DungeonMapInlineLabelUiStateContentPartModel inlineLabelUiStateContentPartModel =
            new DungeonMapInlineLabelUiStateContentPartModel();
    private final DungeonMapRenderSceneContentPartModel renderSceneContentPartModel =
            new DungeonMapRenderSceneContentPartModel();
    private final DungeonMapViewportContentPartModel viewportContentPartModel =
            new DungeonMapViewportContentPartModel();
    private final DungeonMapPointerTargetContentPartModel pointerTargetContentPartModel =
            new DungeonMapPointerTargetContentPartModel();
    private final DungeonMapHitGeometryContentPartModel hitGeometryContentPartModel =
            new DungeonMapHitGeometryContentPartModel();
    private final DungeonMapPreviewDiffContentPartModel previewDiffContentPartModel =
            new DungeonMapPreviewDiffContentPartModel();
    private final DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel =
            new DungeonMapRoomLabelPlacementContentPartModel();
    private final DungeonMapFrameConsumptionContentPartModel frameConsumptionContentPartModel =
            new DungeonMapFrameConsumptionContentPartModel();
    private final DungeonMapSnapshotProjectionContentPartModel snapshotProjectionContentPartModel =
            new DungeonMapSnapshotProjectionContentPartModel();
    private DungeonMapRenderState renderState;

    // Public ContentModel API

    public DungeonMapContentModel(String placeholderTitle, boolean editorMode) {
        this.placeholderTitle = normalizePlaceholderTitle(placeholderTitle);
        canvasState = new ReadOnlyObjectWrapper<>(CanvasState.initial(
                RenderScene.empty(this.placeholderTitle),
                viewportContentPartModel.currentViewport()));
        renderState = DungeonMapRenderState.empty(this.placeholderTitle, editorMode);
        showRenderScene(renderSceneContentPartModel.toSceneProjection(
                renderState,
                PointerTarget.empty()), true);
    }

    public ReadOnlyObjectProperty<CanvasState> canvasStateProperty() {
        return canvasState.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<InlineLabelEditState> inlineLabelEditStateProperty() {
        return inlineLabelUiStateContentPartModel.inlineLabelEditStateProperty();
    }

    public ReadOnlyDoubleProperty zoomProperty() {
        return viewportContentPartModel.zoomProperty();
    }

    CanvasState currentCanvasState() {
        return canvasState.get();
    }

    public InlineLabelEditState currentInlineLabelEditState() {
        return inlineLabelUiStateContentPartModel.currentInlineLabelEditState();
    }

    InlineLabelEditorPresentation currentInlineLabelEditorPresentation() {
        return inlineLabelUiStateContentPartModel.currentInlineLabelEditorPresentation(currentViewport());
    }

    public Viewport currentViewport() {
        return viewportContentPartModel.currentViewport();
    }

    public double currentZoom() {
        return viewportContentPartModel.currentZoom();
    }

    static String defaultTitle() {
        return "Dungeon Map";
    }

    public void resetCamera() {
        refreshCanvasViewport(viewportContentPartModel.resetCamera());
    }

    public void panByPixels(double deltaX, double deltaY) {
        refreshCanvasViewport(viewportContentPartModel.panByPixels(deltaX, deltaY));
    }

    public void zoomAround(double canvasX, double canvasY, double factor) {
        refreshCanvasViewport(viewportContentPartModel.zoomAround(canvasX, canvasY, factor));
    }

    public PointerTarget resolvePointerTarget(double sceneX, double sceneY) {
        return resolvePointerTarget(sceneX, sceneY, false);
    }

    public PointerTarget resolvePointerTarget(double sceneX, double sceneY, boolean preferBoundary) {
        return pointerTargetContentPartModel.choosePrimary(
                hitsAt(sceneX, sceneY),
                frameConsumptionContentPartModel.currentPointerTargets(),
                sceneX,
                sceneY,
                preferBoundary);
    }

    public PointerTarget wallBoundaryHoverTargetAt(double sceneX, double sceneY) {
        return PointerTarget.syntheticBoundary(nearestUnitEdge(sceneX, sceneY, renderState.projectionLevel()));
    }

    public void updateHoverTarget(PointerTarget target) {
        if (!frameConsumptionContentPartModel.updateHoverTarget(target)) {
            return;
        }
        PointerTarget hoverTarget = frameConsumptionContentPartModel.currentHoverTarget();
        showHoverOverlay(hoverTarget);
    }

    public void clearHoverTarget() {
        if (!frameConsumptionContentPartModel.clearHoverTarget()) {
            return;
        }
        setCanvasState(canvasState.get().withHoverOverlay(
                DungeonMapRenderSceneContentPartModel.SceneBuckets.empty(),
                viewportContentPartModel.currentViewport()));
    }

    public PointerTarget resolveLabelPointerTarget(double sceneX, double sceneY, String labelKind) {
        String normalizedLabelKind = normalizeKind(labelKind, EMPTY_LABEL_KIND);
        for (DungeonMapRenderState.Label label : renderState.labels()) {
            if (DungeonMapRenderSceneContentPartModel.LevelFilter.includeLevel(renderState, label.z())
                    && label.labelKind().equals(normalizedLabelKind)
                    && labelContains(label, sceneX, sceneY)) {
                return labelPointerTarget(label);
            }
        }
        return PointerTarget.empty();
    }

    public PointerTarget resolveRoomLabelPointerTarget(double sceneX, double sceneY) {
        return PointerTarget.empty();
    }

    public PointerTarget resolveClusterLabelPointerTarget(double sceneX, double sceneY) {
        return resolveLabelPointerTarget(sceneX, sceneY, CLUSTER_LABEL_KIND);
    }

    public Optional<InlineLabelEditCandidate> inlineLabelEditCandidate(PointerTarget target) {
        return inlineLabelUiStateContentPartModel.inlineLabelEditCandidate(target, renderState.labels());
    }

    public void applyInlineLabelEditProjection(InlineLabelEditProjection projection) {
        inlineLabelUiStateContentPartModel.applyInlineLabelEditProjection(projection);
    }

    public void applyEditorSurfaceFrame(
            DungeonEditorMapSurfaceSnapshot editorSnapshot,
            MapInteractionFrame interactionFrame
    ) {
        DungeonMapFrameConsumptionContentPartModel.EditorSurfaceFrame frame =
                frameConsumptionContentPartModel.consumeEditorSurfaceFrame(editorSnapshot, interactionFrame);
        if (!frame.changed()) {
            return;
        }
        showRenderState(snapshotProjectionContentPartModel.mapEditorSurface(
                placeholderTitle,
                frame.editorSnapshot(),
                frame.interactionFrame(),
                roomLabelPlacementContentPartModel,
                previewDiffContentPartModel), frame.interactionFrame());
    }

    public void applyTravelSnapshot(TravelDungeonSnapshot travelSnapshot) {
        showRenderState(snapshotProjectionContentPartModel.mapTravel(
                placeholderTitle,
                travelSnapshot,
                roomLabelPlacementContentPartModel), frameConsumptionContentPartModel.consumeTravelSnapshot());
    }

    private void showRenderState(DungeonMapRenderState nextRenderState, MapInteractionFrame interactionFrame) {
        renderState = nextRenderState == null ? renderState : nextRenderState;
        PointerTarget retainedHoverTarget = frameConsumptionContentPartModel.consumeRenderFrame(interactionFrame);
        showRenderScene(renderSceneContentPartModel.toSceneProjection(
                renderState,
                PointerTarget.empty()), true);
        if (!retainedHoverTarget.isEmptyTarget()) {
            showHoverOverlay(retainedHoverTarget);
        }
    }

    private void showRenderScene(
            DungeonMapRenderSceneContentPartModel.RenderSceneProjection projection,
            boolean rebuildHitGeometry
    ) {
        RenderScene renderScene = projection == null
                ? RenderScene.empty(placeholderTitle)
                : projection.renderScene();
        if (rebuildHitGeometry) {
            hitGeometryContentPartModel.update(projection == null ? null : projection.buckets(), renderState, renderScene);
        }
        setCanvasState(canvasState.get().withRenderScene(
                renderScene,
                viewportContentPartModel.currentViewport()));
    }

    private void showHoverOverlay(PointerTarget hoverTarget) {
        DungeonMapRenderSceneContentPartModel.SceneBuckets hoverOverlay =
                renderSceneContentPartModel.toHoverOverlay(renderState, hoverTarget);
        setCanvasState(canvasState.get().withHoverOverlay(
                hoverOverlay,
                viewportContentPartModel.currentViewport()));
    }

    private List<DungeonMapHitGeometryContentPartModel.CanvasHit> hitsAt(double sceneX, double sceneY) {
        return hitGeometryContentPartModel.hitsAt(sceneX, sceneY, currentViewport().gridSize());
    }

    private static BoundaryTarget nearestUnitEdge(
            double sceneX,
            double sceneY,
            int level
    ) {
        int cellQ = (int) Math.floor(sceneX);
        int cellR = (int) Math.floor(sceneY);
        double localQ = sceneX - cellQ;
        double localR = sceneY - cellR;
        double distanceWest = Math.abs(localQ);
        double distanceEast = Math.abs(1.0 - localQ);
        double distanceNorth = Math.abs(localR);
        double distanceSouth = Math.abs(1.0 - localR);
        double best = Math.min(Math.min(distanceWest, distanceEast), Math.min(distanceNorth, distanceSouth));
        if (best == distanceNorth) {
            return syntheticBoundaryTarget(cellQ, cellR, level, cellQ + 1, cellR, level);
        }
        if (best == distanceSouth) {
            return syntheticBoundaryTarget(cellQ, cellR + 1, level, cellQ + 1, cellR + 1, level);
        }
        if (best == distanceWest) {
            return syntheticBoundaryTarget(cellQ, cellR, level, cellQ, cellR + 1, level);
        }
        return syntheticBoundaryTarget(cellQ + 1, cellR, level, cellQ + 1, cellR + 1, level);
    }

    private static BoundaryTarget syntheticBoundaryTarget(
            double startQ,
            double startR,
            int startLevel,
            double endQ,
            double endR,
            int endLevel
    ) {
        String key = "hover-boundary:" + WALL_KIND + ":" + startQ + ":" + startR + ":" + startLevel
                + ":" + endQ + ":" + endR + ":" + endLevel;
        return new BoundaryTarget(
                WALL_KIND,
                key,
                0L,
                EMPTY_KIND,
                0L,
                startQ,
                startR,
                startLevel,
                endQ,
                endR,
                endLevel);
    }

    private static boolean labelContains(DungeonMapRenderState.Label label, double sceneX, double sceneY) {
        return DungeonMapHitGeometryContentPartModel.pointInPolygon(
                sceneX,
                sceneY,
                DungeonMapRenderSceneContentPartModel.SceneGeometry.rotatedCenteredRect(
                        label.q(),
                        label.r(),
                        DungeonMapRenderSceneContentPartModel.SceneGeometry.Label.labelWidthScene(label),
                        DungeonMapRenderSceneContentPartModel.SceneGeometry.Label.labelHeightScene(label),
                        label.rotationDegrees()));
    }

    private static PointerTarget labelPointerTarget(DungeonMapRenderState.Label label) {
        return PointerTarget.label(label.labelKind(), label.ownerId(), label.clusterId(), label.topologyRef());
    }

    static PointerTarget selectableHoverTarget(PointerTarget target) {
        return DungeonMapFrameConsumptionContentPartModel.selectableHoverTarget(target);
    }

    private void setCanvasState(CanvasState nextState) {
        canvasState.set(nextState);
    }

    private void refreshCanvasViewport(Viewport nextViewport) {
        setCanvasState(canvasState.get().withViewport(nextViewport));
    }

    private static String normalizePlaceholderTitle(String placeholderTitle) {
        return placeholderTitle == null || placeholderTitle.isBlank()
                ? defaultTitle()
                : placeholderTitle;
    }

    public static final class CanvasState {
        private final RenderScene renderScene;
        private final DungeonMapRenderSceneContentPartModel.SceneBuckets hoverOverlay;
        private final Viewport viewport;

        private static CanvasState initial(RenderScene renderScene, Viewport viewport) {
            return new CanvasState(
                renderScene,
                    DungeonMapRenderSceneContentPartModel.SceneBuckets.empty(),
                    viewport);
        }

        private CanvasState(
                RenderScene renderScene,
                DungeonMapRenderSceneContentPartModel.SceneBuckets hoverOverlay,
                Viewport viewport
        ) {
            this.renderScene = renderScene == null ? RenderScene.empty(defaultTitle()) : renderScene;
            this.hoverOverlay = hoverOverlay == null
                    ? DungeonMapRenderSceneContentPartModel.SceneBuckets.empty()
                    : hoverOverlay;
            this.viewport = viewport == null ? Viewport.initial() : viewport;
        }

        public RenderScene baseRenderScene() {
            return renderScene;
        }

        public RenderScene renderScene() {
            return renderScene.withHoverOverlay(hoverOverlay);
        }

        public List<MapCanvasPolygonPrimitive> hoverSurfaces() {
            return hoverOverlay.surfaces();
        }

        public List<BoundaryPrimitive> hoverBoundaries() {
            return hoverOverlay.boundaries();
        }

        public List<GlyphPrimitive> hoverGlyphs() {
            return hoverOverlay.glyphs();
        }

        public List<TextPrimitive> hoverTexts() {
            return hoverOverlay.texts();
        }

        public Viewport viewport() {
            return viewport;
        }

        private CanvasState withRenderScene(RenderScene nextRenderScene, Viewport nextViewport) {
            return new CanvasState(
                    nextRenderScene,
                    DungeonMapRenderSceneContentPartModel.SceneBuckets.empty(),
                    nextViewport);
        }

        private CanvasState withHoverOverlay(
                DungeonMapRenderSceneContentPartModel.SceneBuckets nextHoverOverlay,
                Viewport nextViewport
        ) {
            return new CanvasState(
                    renderScene,
                    nextHoverOverlay,
                    nextViewport);
        }

        private CanvasState withViewport(Viewport nextViewport) {
            return new CanvasState(renderScene, hoverOverlay, nextViewport);
        }
    }

    public record InlineLabelEditState(
            boolean active,
            PointerTarget target,
            String text,
            double centerX,
            double centerY,
            double width,
            double height,
            double rotationDegrees
    ) {

        public InlineLabelEditState {
            target = target == null ? PointerTarget.empty() : target;
            text = text == null ? "" : text;
            width = Math.max(1.0, width);
            height = Math.max(0.6, height);
        }

        static InlineLabelEditState inactive() {
            return new InlineLabelEditState(false, PointerTarget.empty(), "", 0.0, 0.0, 1.0, 0.6, 0.0);
        }

        static InlineLabelEditState active(
                PointerTarget target,
                String text,
                double centerX,
                double centerY,
                double width,
                double height,
                double rotationDegrees
        ) {
            return new InlineLabelEditState(true, target, text, centerX, centerY, width, height, rotationDegrees);
        }
    }

    public record InlineLabelEditProjection(
            boolean active,
            String labelKind,
            long ownerId,
            long clusterId,
            String topologyKind,
            long topologyId,
            String text,
            double centerX,
            double centerY,
            double width,
            double height,
            double rotationDegrees
    ) {
        public InlineLabelEditProjection {
            labelKind = normalizeInlineLabelKind(labelKind, EMPTY_LABEL_KIND);
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyKind = normalizeInlineLabelKind(topologyKind, EMPTY_KIND);
            topologyId = Math.max(0L, topologyId);
            text = text == null ? "" : text;
            width = Math.max(1.0, width);
            height = Math.max(0.6, height);
        }

        public static InlineLabelEditProjection inactive() {
            return new InlineLabelEditProjection(
                    false,
                    EMPTY_LABEL_KIND,
                    0L,
                    0L,
                    EMPTY_KIND,
                    0L,
                    "",
                    0.0,
                    0.0,
                    1.0,
                    0.6,
                    0.0);
        }
    }

    public record InlineLabelEditCandidate(
            PointerTarget target,
            String text,
            double centerX,
            double centerY,
            double width,
            double height,
            double rotationDegrees
    ) {
        public InlineLabelEditCandidate {
            target = target == null ? PointerTarget.empty() : target;
            text = text == null ? "" : text;
            width = Math.max(1.0, width);
            height = Math.max(0.6, height);
        }
    }

    record InlineLabelEditorPresentation(
            boolean visible,
            String text,
            double screenX,
            double screenY,
            double width,
            double height,
            double rotationDegrees
    ) {

        static InlineLabelEditorPresentation hidden() {
            return new InlineLabelEditorPresentation(false, "", 0.0, 0.0, 0.0, 0.0, 0.0);
        }

        InlineLabelEditorPresentation {
            text = text == null ? "" : text;
            width = Math.max(0.0, width);
            height = Math.max(0.0, height);
        }
    }

    private static String normalizeInlineLabelKind(String value, String fallback) {
        String safeFallback = fallback == null || fallback.isBlank() ? EMPTY_KIND : fallback;
        return value == null || value.isBlank()
                ? safeFallback
                : value.trim().toUpperCase(Locale.ROOT);
    }

    public record Viewport(
            double panX,
            double panY,
            double zoom
    ) {

        static Viewport initial() {
            return new Viewport(0.0, 0.0, DungeonMapViewportContentPartModel.defaultZoom());
        }

        public Viewport {
            zoom = Math.max(
                    DungeonMapViewportContentPartModel.minimumZoom(),
                    Math.min(DungeonMapViewportContentPartModel.maximumZoom(), zoom));
        }

        public double gridSize() {
            return DungeonMapViewportContentPartModel.baseGrid() * zoom;
        }

        public double sceneToScreenX(double sceneX) {
            return panX + sceneX * gridSize();
        }

        public double sceneToScreenY(double sceneY) {
            return panY + sceneY * gridSize();
        }

        public double screenToSceneX(double screenX) {
            return (screenX - panX) / gridSize();
        }

        public double screenToSceneY(double screenY) {
            return (screenY - panY) / gridSize();
        }

        public double normalizedOffset(double spacing, boolean horizontal) {
            double pan = horizontal ? panX : panY;
            double offset = pan % spacing;
            return offset < 0.0 ? offset + spacing : offset;
        }
    }

    private static String normalizeTitle(String title) {
        return title == null || title.isBlank() ? defaultTitle() : title.trim();
    }

    private static <T> List<T> copyOf(@Nullable List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    public record RenderColor(
            int red,
            int green,
            int blue,
            int alpha
    ) {

        public RenderColor {
            red = clampChannel(red);
            green = clampChannel(green);
            blue = clampChannel(blue);
            alpha = clampChannel(alpha);
        }

        public static RenderColor color(int red, int green, int blue, double opacity) {
            return new RenderColor(red, green, blue, toChannel(opacity));
        }

        public static RenderColor blend(RenderColor base, RenderColor tint, double weight) {
            double clampedWeight = Math.max(0.0, Math.min(1.0, weight));
            double inverseWeight = 1.0 - clampedWeight;
            return new RenderColor(
                    blendChannel(base.red(), tint.red(), inverseWeight, clampedWeight),
                    blendChannel(base.green(), tint.green(), inverseWeight, clampedWeight),
                    blendChannel(base.blue(), tint.blue(), inverseWeight, clampedWeight),
                    blendChannel(base.alpha(), tint.alpha(), inverseWeight, clampedWeight));
        }

        public double redUnit() {
            return red / (double) maximumChannel();
        }

        public double greenUnit() {
            return green / (double) maximumChannel();
        }

        public double blueUnit() {
            return blue / (double) maximumChannel();
        }

        public double alphaUnit() {
            return alpha / (double) maximumChannel();
        }

        private static int blendChannel(int base, int tint, double inverseWeight, double weight) {
            return clampChannel((int) Math.round(base * inverseWeight + tint * weight));
        }

        private static int toChannel(double value) {
            return clampChannel((int) Math.round(clampUnit(value) * maximumChannel()));
        }

        private static int clampChannel(int value) {
            return Math.max(0, Math.min(maximumChannel(), value));
        }

        private static double clampUnit(double value) {
            return Math.max(0.0, Math.min(1.0, value));
        }

        private static int maximumChannel() {
            return 255;
        }
    }

    public record RenderScene(
            String title,
            String subtitle,
            String modeLabel,
            String statusLabel,
            String summaryLabel,
            boolean sceneLoaded,
            String overlayMessage,
            boolean gridView,
            List<MapCanvasPolygonPrimitive> surfaces,
            List<BoundaryPrimitive> boundaries,
            List<GlyphPrimitive> glyphs,
            List<TextPrimitive> texts,
            List<RelationPrimitive> relations,
            List<MapCanvasPolygonPrimitive> actors,
            List<MapCanvasPolygonPrimitive> hoverSurfaces,
            List<BoundaryPrimitive> hoverBoundaries,
            List<GlyphPrimitive> hoverGlyphs,
            List<TextPrimitive> hoverTexts
    ) {

        public RenderScene {
            title = normalizeTitle(title);
            subtitle = subtitle == null ? "" : subtitle;
            modeLabel = modeLabel == null ? "" : modeLabel;
            statusLabel = statusLabel == null ? "" : statusLabel;
            summaryLabel = summaryLabel == null ? "" : summaryLabel;
            overlayMessage = overlayMessage == null ? "" : overlayMessage;
            surfaces = copyOf(surfaces);
            boundaries = copyOf(boundaries);
            glyphs = copyOf(glyphs);
            texts = copyOf(texts);
            relations = copyOf(relations);
            actors = copyOf(actors);
            hoverSurfaces = copyOf(hoverSurfaces);
            hoverBoundaries = copyOf(hoverBoundaries);
            hoverGlyphs = copyOf(hoverGlyphs);
            hoverTexts = copyOf(hoverTexts);
        }

        public static RenderScene empty(String title) {
            return new RenderScene(
                    title,
                    "",
                    "",
                    "",
                    "",
                    false,
                    "No map scene loaded.",
                    true,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of());
        }

        RenderScene withHoverOverlay(DungeonMapRenderSceneContentPartModel.SceneBuckets hoverOverlay) {
            DungeonMapRenderSceneContentPartModel.SceneBuckets safeOverlay = hoverOverlay == null
                    ? DungeonMapRenderSceneContentPartModel.SceneBuckets.empty()
                    : hoverOverlay;
            return new RenderScene(
                    title,
                    subtitle,
                    modeLabel,
                    statusLabel,
                    summaryLabel,
                    sceneLoaded,
                    overlayMessage,
                    gridView,
                    surfaces,
                    boundaries,
                    glyphs,
                    texts,
                    relations,
                    actors,
                    safeOverlay.surfaces(),
                    safeOverlay.boundaries(),
                    safeOverlay.glyphs(),
                    safeOverlay.texts());
        }

        public boolean gridView() {
            return gridView;
        }

        public boolean containsRenderablePrimitives() {
            return containsSurfacePrimitives()
                    || containsAnnotationPrimitives();
        }

        public boolean containsSurfacePrimitives() {
            return !surfaces.isEmpty()
                    || !boundaries.isEmpty()
                    || !glyphs.isEmpty()
                    || !actors.isEmpty();
        }

        public boolean containsAnnotationPrimitives() {
            return !texts.isEmpty() || !relations.isEmpty();
        }

        @Override
        public List<MapCanvasPolygonPrimitive> surfaces() {
            if (hoverSurfaces.isEmpty()) {
                return copyOf(surfaces);
            }
            List<MapCanvasPolygonPrimitive> combined = new java.util.ArrayList<>(surfaces.size() + hoverSurfaces.size());
            combined.addAll(surfaces);
            combined.addAll(hoverSurfaces);
            return List.copyOf(combined);
        }

        @Override
        public List<BoundaryPrimitive> boundaries() {
            if (hoverBoundaries.isEmpty()) {
                return copyOf(boundaries);
            }
            List<BoundaryPrimitive> combined = new java.util.ArrayList<>(boundaries.size() + hoverBoundaries.size());
            combined.addAll(boundaries);
            combined.addAll(hoverBoundaries);
            return List.copyOf(combined);
        }

        @Override
        public List<GlyphPrimitive> glyphs() {
            if (hoverGlyphs.isEmpty()) {
                return copyOf(glyphs);
            }
            List<GlyphPrimitive> combined = new java.util.ArrayList<>(glyphs.size() + hoverGlyphs.size());
            combined.addAll(glyphs);
            combined.addAll(hoverGlyphs);
            return List.copyOf(combined);
        }

        @Override
        public List<TextPrimitive> texts() {
            if (hoverTexts.isEmpty()) {
                return copyOf(texts);
            }
            List<TextPrimitive> combined = new java.util.ArrayList<>(texts.size() + hoverTexts.size());
            combined.addAll(texts);
            combined.addAll(hoverTexts);
            return List.copyOf(combined);
        }

        @Override
        public List<RelationPrimitive> relations() {
            return copyOf(relations);
        }

        @Override
        public List<MapCanvasPolygonPrimitive> actors() {
            return copyOf(actors);
        }

        List<MapCanvasPolygonPrimitive> baseSurfaces() {
            return copyOf(surfaces);
        }

        List<BoundaryPrimitive> baseBoundaries() {
            return copyOf(boundaries);
        }

        List<GlyphPrimitive> baseGlyphs() {
            return copyOf(glyphs);
        }

        List<TextPrimitive> baseTexts() {
            return copyOf(texts);
        }

        @Override
        public List<MapCanvasPolygonPrimitive> hoverSurfaces() {
            return copyOf(hoverSurfaces);
        }

        @Override
        public List<BoundaryPrimitive> hoverBoundaries() {
            return copyOf(hoverBoundaries);
        }

        @Override
        public List<GlyphPrimitive> hoverGlyphs() {
            return copyOf(hoverGlyphs);
        }

        @Override
        public List<TextPrimitive> hoverTexts() {
            return copyOf(hoverTexts);
        }

    }

    public record PaintStyle(
            @Nullable RenderColor fill,
            @Nullable RenderColor stroke,
            double strokeWidth,
            double alpha,
            boolean dashed
    ) {

        public PaintStyle {
            strokeWidth = Math.max(0.0, strokeWidth);
            alpha = Math.max(0.0, Math.min(1.0, alpha));
        }
    }

    public record MapCanvasPoint(double x, double y) {
    }

    public record MapCanvasPolygonPrimitive(
            String hitRef,
            String selectionRef,
            int z,
            List<MapCanvasPoint> polygon,
            PaintStyle style
    ) {

        public MapCanvasPolygonPrimitive {
            hitRef = hitRef == null ? "" : hitRef;
            selectionRef = selectionRef == null ? "" : selectionRef;
            polygon = copyOf(polygon);
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
        }

        @Override
        public List<MapCanvasPoint> polygon() {
            return copyOf(polygon);
        }
    }

    public record BoundaryPrimitive(
            String hitRef,
            String selectionRef,
            int z,
            List<MapCanvasPoint> polyline,
            PaintStyle style
    ) {

        public BoundaryPrimitive {
            hitRef = hitRef == null ? "" : hitRef;
            selectionRef = selectionRef == null ? "" : selectionRef;
            polyline = copyOf(polyline);
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
        }

        @Override
        public List<MapCanvasPoint> polyline() {
            return copyOf(polyline);
        }
    }

    public record GlyphPrimitive(
            String hitRef,
            String selectionRef,
            int z,
            List<MapCanvasPoint> polygon,
            PaintStyle style,
            String label,
            @Nullable RenderColor labelColor
    ) {

        public GlyphPrimitive {
            hitRef = hitRef == null ? "" : hitRef;
            selectionRef = selectionRef == null ? "" : selectionRef;
            polygon = copyOf(polygon);
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
            label = label == null ? "" : label;
            labelColor = labelColor == null ? RenderColor.color(255, 255, 255, 1.0) : labelColor;
        }

        @Override
        public List<MapCanvasPoint> polygon() {
            return copyOf(polygon);
        }
    }

    public record TextPrimitive(
            String hitRef,
            String selectionRef,
            int z,
            String text,
            double centerX,
            double centerY,
            double width,
            double height,
            double rotationDegrees,
            LabelTypography typography,
            PaintStyle style,
            @Nullable RenderColor textColor
    ) {

        public TextPrimitive {
            hitRef = hitRef == null ? "" : hitRef;
            selectionRef = selectionRef == null ? "" : selectionRef;
            text = text == null ? "" : text;
            width = Math.max(0.0, width);
            height = Math.max(0.0, height);
            typography = typography == null ? LabelTypography.mapLabel() : typography;
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
            textColor = textColor == null ? RenderColor.color(255, 255, 255, 1.0) : textColor;
        }
    }

    public record LabelTypography(
            String cssClass,
            String fontFamily,
            double fontSizePixels,
            boolean bold
    ) {
        private static final LabelTypography MAP_LABEL = new LabelTypography(
                "dungeon-map-inline-label-editor",
                "SansSerif",
                13.0,
                true);

        public LabelTypography {
            cssClass = cssClass == null ? "" : cssClass;
            fontFamily = fontFamily == null || fontFamily.isBlank() ? "SansSerif" : fontFamily;
            fontSizePixels = Math.max(1.0, fontSizePixels);
        }

        public static LabelTypography mapLabel() {
            return MAP_LABEL;
        }

        public static LabelTypography roomLabel(double fontSizePixels) {
            return new LabelTypography(
                    "dungeon-map-inline-label-room",
                    "Monospaced",
                    fontSizePixels,
                    true);
        }
    }

    public record RelationPrimitive(
            String hitRef,
            int z,
            List<MapCanvasPoint> polyline,
            PaintStyle style
    ) {

        public RelationPrimitive {
            hitRef = hitRef == null ? "" : hitRef;
            polyline = copyOf(polyline);
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
        }

        @Override
        public List<MapCanvasPoint> polyline() {
            return copyOf(polyline);
        }
    }

    public record MapInteractionFrame(
            Map<String, PointerTarget> pointerTargets,
            List<String> previewHandleHitRefs
    ) {
        public MapInteractionFrame {
            pointerTargets = pointerTargets == null ? Map.of() : Map.copyOf(pointerTargets);
            previewHandleHitRefs = previewHandleHitRefs == null
                    ? List.of()
                    : List.copyOf(previewHandleHitRefs);
        }

        public static MapInteractionFrame empty() {
            return new MapInteractionFrame(Map.of(), List.of());
        }
    }

    static final class CellTarget {
        private static final CellTarget EMPTY = new CellTarget("", 0, 0, 0);

        private final String key;
        private final int q;
        private final int r;
        private final int level;

        CellTarget(String key, int q, int r, int level) {
            this.key = key == null ? "" : key.strip();
            this.q = q;
            this.r = r;
            this.level = level;
        }

        static CellTarget empty() {
            return EMPTY;
        }

        int q() {
            return q;
        }

        int r() {
            return r;
        }

        int level() {
            return level;
        }

        boolean exact() {
            return !key.isBlank();
        }
    }

    static final class VertexTarget {
        private static final VertexTarget EMPTY = new VertexTarget(false, 0, 0, 0);

        private final boolean exact;
        private final int q;
        private final int r;
        private final int level;

        VertexTarget(boolean exact, int q, int r, int level) {
            this.exact = exact;
            this.q = q;
            this.r = r;
            this.level = level;
        }

        static VertexTarget empty() {
            return EMPTY;
        }

        int q() {
            return q;
        }

        int r() {
            return r;
        }

        int level() {
            return level;
        }

        boolean exact() {
            return exact;
        }
    }

    public record BoundaryTarget(
            BoundaryTargetKind boundaryKind,
            String key,
            long ownerId,
            String topologyKind,
            long topologyId,
            double startQ,
            double startR,
            int startLevel,
            double endQ,
            double endR,
            int endLevel
    ) {
        public BoundaryTarget {
            boundaryKind = boundaryKind == null ? BoundaryTargetKind.WALL : boundaryKind;
            key = key == null ? "" : key.strip();
            ownerId = Math.max(0L, ownerId);
            topologyKind = normalizeKind(topologyKind, EMPTY_KIND);
            topologyId = Math.max(0L, topologyId);
            startQ = Double.isFinite(startQ) ? startQ : 0.0;
            startR = Double.isFinite(startR) ? startR : 0.0;
            endQ = Double.isFinite(endQ) ? endQ : 0.0;
            endR = Double.isFinite(endR) ? endR : 0.0;
        }

        @SuppressWarnings("PMD.ExcessiveParameterList")
        public BoundaryTarget(
                String boundaryKind,
                String key,
                long ownerId,
                String topologyKind,
                long topologyId,
                double startQ,
                double startR,
                int startLevel,
                double endQ,
                double endR,
                int endLevel
        ) {
            this(
                    BoundaryTargetKind.fromLegacy(boundaryKind),
                    key,
                    ownerId,
                    topologyKind,
                    topologyId,
                    startQ,
                    startR,
                    startLevel,
                    endQ,
                    endR,
                    endLevel);
        }

        public static BoundaryTarget empty() {
            return new BoundaryTarget(BoundaryTargetKind.WALL, "", 0L, EMPTY_KIND, 0L, 0.0, 0.0, 0, 0.0, 0.0, 0);
        }
    }

    public enum BoundaryTargetKind {
        WALL(WALL_KIND),
        DOOR("DOOR");

        private final String legacyName;

        BoundaryTargetKind(String legacyName) {
            this.legacyName = legacyName;
        }

        public String legacyName() {
            return legacyName;
        }

        static BoundaryTargetKind fromLegacy(String value) {
            String normalized = normalizeKind(value, WALL_KIND);
            for (BoundaryTargetKind kind : values()) {
                if (kind.name().equals(normalized) || kind.legacyName.equals(normalized)) {
                    return kind;
                }
            }
            return WALL;
        }
    }

    public enum PointerTargetKind {
        EMPTY,
        HANDLE,
        BOUNDARY,
        LABEL,
        CELL,
        GRAPH_NODE,
        VERTEX;

        static PointerTargetKind fromLegacy(String value) {
            String normalized = normalizeKind(value, EMPTY_KIND);
            for (PointerTargetKind kind : values()) {
                if (kind.name().equals(normalized)) {
                    return kind;
                }
            }
            return EMPTY;
        }
    }

    public record PointerTarget(
            PointerTargetKind targetKind,
            String labelKind,
            String elementKind,
            long ownerId,
            long clusterId,
            String topologyKind,
            long topologyId,
            DungeonEditorHandleRef handleRef,
            BoundaryTarget boundaryRef,
            String syntheticHoverKind,
            CellTarget cellRef,
            VertexTarget vertexRef
    ) {
        public PointerTarget {
            targetKind = targetKind == null ? PointerTargetKind.EMPTY : targetKind;
            labelKind = normalizeKind(labelKind, EMPTY_LABEL_KIND);
            elementKind = normalizeKind(elementKind, EMPTY_KIND);
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyKind = normalizeKind(topologyKind, EMPTY_KIND);
            topologyId = Math.max(0L, topologyId);
            handleRef = handleRef == null ? DungeonEditorHandleRef.empty() : handleRef;
            boundaryRef = boundaryRef == null ? BoundaryTarget.empty() : boundaryRef;
            syntheticHoverKind = normalizeKind(syntheticHoverKind, SYNTHETIC_HOVER_NONE_KIND);
            cellRef = cellRef == null ? CellTarget.empty() : cellRef;
            vertexRef = vertexRef == null ? VertexTarget.empty() : vertexRef;
        }

        public static PointerTarget empty() {
            return new PointerTarget(
                    PointerTargetKind.EMPTY,
                    EMPTY_LABEL_KIND,
                    EMPTY_KIND,
                    0L,
                    0L,
                    EMPTY_KIND,
                    0L,
                    DungeonEditorHandleRef.empty(),
                    BoundaryTarget.empty(),
                    SYNTHETIC_HOVER_NONE_KIND,
                    CellTarget.empty(),
                    VertexTarget.empty());
        }

        @SuppressWarnings({"PMD.ExcessiveParameterList", "PMD.UseObjectForClearerAPI"})
        public static PointerTarget target(
                String targetKind,
                String labelKind,
                String elementKind,
                long ownerId,
                long clusterId,
                String topologyKind,
                long topologyId,
                DungeonEditorHandleRef handleRef,
                BoundaryTarget boundaryRef,
                String syntheticHoverKind
        ) {
            return new PointerTarget(
                    PointerTargetKind.fromLegacy(targetKind),
                    labelKind,
                    elementKind,
                    ownerId,
                    clusterId,
                    topologyKind,
                    topologyId,
                    handleRef,
                    boundaryRef,
                    syntheticHoverKind,
                    CellTarget.empty(),
                    VertexTarget.empty());
        }

        public static PointerTarget label(
                String labelKind,
                long ownerId,
                long clusterId,
                DungeonMapRenderState.TopologyRef topologyRef
        ) {
            DungeonMapRenderState.TopologyRef safeTopologyRef = topologyRef == null
                    ? DungeonMapRenderState.TopologyRef.empty()
                    : topologyRef;
            return new PointerTarget(
                    PointerTargetKind.LABEL,
                    labelKind,
                    safeTopologyRef.kind(),
                    ownerId,
                    clusterId,
                    safeTopologyRef.kind(),
                    safeTopologyRef.id(),
                    DungeonEditorHandleRef.empty(),
                    BoundaryTarget.empty(),
                    SYNTHETIC_HOVER_NONE_KIND,
                    CellTarget.empty(),
                    VertexTarget.empty());
        }

        public static PointerTarget syntheticCell(String elementKind, int q, int r, int level) {
            return new PointerTarget(
                    PointerTargetKind.CELL,
                    EMPTY_LABEL_KIND,
                    elementKind,
                    0L,
                    0L,
                    EMPTY_KIND,
                    0L,
                    DungeonEditorHandleRef.empty(),
                    BoundaryTarget.empty(),
                    "CELL",
                    new CellTarget("hover-cell:" + elementKind + ":" + q + ":" + r + ":" + level, q, r, level),
                    VertexTarget.empty());
        }

        public static PointerTarget syntheticBoundary(BoundaryTarget boundaryTarget) {
            BoundaryTarget safeBoundary = boundaryTarget == null ? BoundaryTarget.empty() : boundaryTarget;
            return new PointerTarget(
                    PointerTargetKind.BOUNDARY,
                    EMPTY_LABEL_KIND,
                    safeBoundary.boundaryKind().legacyName(),
                    safeBoundary.ownerId(),
                    0L,
                    safeBoundary.topologyKind(),
                    safeBoundary.topologyId(),
                    DungeonEditorHandleRef.empty(),
                    safeBoundary,
                    "BOUNDARY",
                    CellTarget.empty(),
                    VertexTarget.empty());
        }

        public static PointerTarget syntheticVertex(int q, int r, int level) {
            return new PointerTarget(
                    PointerTargetKind.VERTEX,
                    EMPTY_LABEL_KIND,
                    "WALL_VERTEX",
                    0L,
                    0L,
                    EMPTY_KIND,
                    0L,
                    DungeonEditorHandleRef.empty(),
                    BoundaryTarget.empty(),
                    "VERTEX",
                    CellTarget.empty(),
                    new VertexTarget(true, q, r, level));
        }

        public PointerTarget withCellRef(CellTarget nextCellRef) {
            return new PointerTarget(
                    targetKind,
                    labelKind,
                    elementKind,
                    ownerId,
                    clusterId,
                    topologyKind,
                    topologyId,
                    handleRef,
                    boundaryRef,
                    syntheticHoverKind,
                    nextCellRef,
                    vertexRef);
        }

        public boolean syntheticHoverTarget() {
            return !SYNTHETIC_HOVER_NONE_KIND.equals(syntheticHoverKind);
        }

        public boolean isEmptyTarget() {
            return targetKind == PointerTargetKind.EMPTY;
        }

        public boolean isBoundaryTarget() {
            return targetKind == PointerTargetKind.BOUNDARY;
        }

        public boolean isVertexTarget() {
            return targetKind == PointerTargetKind.VERTEX;
        }

        public boolean isCellTarget() {
            return targetKind == PointerTargetKind.CELL;
        }

        public boolean isHandleTarget() {
            return targetKind == PointerTargetKind.HANDLE;
        }

        public boolean isGraphNodeTarget() {
            return targetKind == PointerTargetKind.GRAPH_NODE && topologyId > 0L && !EMPTY_KIND.equals(topologyKind);
        }

        public int vertexQ() {
            return vertexRef.q();
        }

        public int vertexR() {
            return vertexRef.r();
        }

        public String topologyKind() {
            return topologyKind;
        }

        public long topologyId() {
            return topologyId;
        }

        public boolean isLabelTarget() {
            return targetKind == PointerTargetKind.LABEL;
        }

        public boolean isClusterLabelTarget() {
            return isLabelTarget() && CLUSTER_LABEL_KIND.equals(labelKind());
        }

        public boolean isRoomLabelTarget() {
            return isLabelTarget() && ROOM_LABEL_KIND.equals(labelKind());
        }

        public String labelKind() {
            return labelKind;
        }

        public String elementKind() {
            return elementKind;
        }

        public long ownerId() {
            return ownerId;
        }

        public long clusterId() {
            return clusterId;
        }

        public DungeonMapRenderState.TopologyRef topologyRef() {
            return new DungeonMapRenderState.TopologyRef(topologyKind(), topologyId());
        }

        public DungeonEditorHandleRef handleRef() {
            return handleRef;
        }

        public BoundaryTarget boundaryRef() {
            return boundaryRef;
        }
    }

    private static String normalizeKind(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

// Render-state values
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
                selectToolLabel(),
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

        static Topology fromName(String topologyName) {
            return "HEX".equalsIgnoreCase(topologyName) ? HEX : SQUARE;
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
        TRANSITION,
        FEATURE_POI,
        FEATURE_OBJECT,
        FEATURE_ENCOUNTER;
    }

    enum EdgeKind {
        WALL,
        DOOR;
    }

    enum MarkerKind {
        DOOR,
        STAIR,
        TRANSITION,
        WAYPOINT,
        CLUSTER,
        FEATURE_POI,
        FEATURE_OBJECT,
        FEATURE_ENCOUNTER;
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

        static Heading fromEditor(DungeonTravelHeading heading) {
            if (heading == null) {
                return SOUTH;
            }
            return switch (heading) {
                case NORTH -> NORTH;
                case EAST -> EAST;
                case WEST -> WEST;
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

        LevelOverlaySettings {
            mode = mode == null ? OverlayMode.OFF : mode;
            levelRange = Math.max(1, Math.min(maximumLevelRange(), levelRange));
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
            return new LevelOverlaySettings(OverlayMode.NEARBY, defaultLevelRange(), defaultOpacity(), List.of());
        }

        static LevelOverlaySettings off() {
            return new LevelOverlaySettings(OverlayMode.OFF, defaultLevelRange(), defaultOpacity(), List.of());
        }

        private static int defaultLevelRange() {
            return 2;
        }

        private static int maximumLevelRange() {
            return 6;
        }

        private static double defaultOpacity() {
            return 0.35;
        }
    }

    record TopologyRef(String kind, long id) {

        TopologyRef {
            kind = kind == null || kind.isBlank() ? emptyKind() : kind.trim();
            id = Math.max(0L, id);
        }

        boolean isEmpty() {
            return id <= 0L || emptyKind().equals(kind);
        }

        static TopologyRef empty() {
            return new TopologyRef(emptyKind(), 0L);
        }
    }

    record MarkerHandle(
            @Nullable DungeonEditorHandleRef ref,
            int q,
            int r,
            int level,
            DungeonMapRenderState.TopologyRef explicitTopologyRef
    ) {
        @Nullable DungeonEditorHandleKind kind() {
            return ref == null ? null : ref.kind();
        }

        DungeonMapRenderState.TopologyRef topologyRef() {
            if (ref != null) {
                return DungeonMapEditorProjectionContentPartModel.topologyRef(ref.topologyRef());
            }
            return explicitTopologyRef == null ? TopologyRef.empty() : explicitTopologyRef;
        }

        String direction() {
            return ref == null ? "" : ref.direction();
        }

        @Nullable DungeonEdgeRef sourceEdge() {
            return ref == null ? null : ref.sourceEdge();
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
            String labelKind,
            boolean selected,
            boolean preview,
            double availableWidthScene,
            double rotationDegrees
    ) {

        Label {
            label = label == null ? "" : label;
            topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
            labelKind = normalizeKind(labelKind, EMPTY_LABEL_KIND);
            availableWidthScene = Math.max(0.0, availableWidthScene);
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
                    ? new MarkerHandle(null, 0, 0, 0, null)
                    : handle;
        }

        boolean isDoorMarker() {
            return kind == MarkerKind.DOOR;
        }

        boolean isWallRunMarker() {
            return handle.kind() == DungeonEditorHandleKind.CLUSTER_WALL_RUN;
        }

        boolean isClusterCornerMarker() {
            return handle.kind() == DungeonEditorHandleKind.CLUSTER_CORNER;
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
        return title == null || title.isBlank() ? defaultTitle() : title.trim();
    }

    private static String normalizeTool(String selectedTool) {
        return selectedTool == null || selectedTool.isBlank() ? selectToolLabel() : selectedTool;
    }

    static String selectToolLabel() {
        return DungeonEditorTool.SELECT.displayLabel();
    }

    private static String emptyKind() {
        return "EMPTY";
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
}
