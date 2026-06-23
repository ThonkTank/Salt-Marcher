package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import javafx.beans.property.ReadOnlyDoubleProperty;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorPreviewDiff;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorSurface;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;
import src.domain.dungeon.published.TravelDungeonSnapshot;

public final class DungeonMapContentModel {

    private static final String EMPTY_KIND = "EMPTY";
    private static final String EMPTY_LABEL_KIND = EMPTY_KIND;
    static final String ROOM_LABEL_KIND = "ROOM_LABEL";
    static final String CLUSTER_LABEL_KIND = "CLUSTER_LABEL";
    private static final String FEATURE_LABEL_KIND = "FEATURE_LABEL";

    private final String placeholderTitle;
    private final ReadOnlyObjectWrapper<CanvasState> canvasState;
    private final ReadOnlyObjectWrapper<InlineLabelEditState> inlineLabelEditState;
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
    private DungeonMapRenderState renderState;
    private DungeonEditorMapSurfaceSnapshot currentEditorSurfaceSnapshot = DungeonEditorMapSurfaceSnapshot.empty();
    private MapInteractionFrame currentMapInteractionFrame = MapInteractionFrame.empty();
    private boolean editorSurfaceSnapshotCurrent;
    private PointerTarget currentHoverTarget = PointerTarget.empty();
    private Map<String, PointerTarget> pointerTargets = Map.of();

    // Public ContentModel API

    public DungeonMapContentModel(String placeholderTitle, boolean editorMode) {
        this.placeholderTitle = normalizePlaceholderTitle(placeholderTitle);
        canvasState = new ReadOnlyObjectWrapper<>(CanvasState.initial(
                RenderScene.empty(this.placeholderTitle),
                viewportContentPartModel.currentViewport()));
        inlineLabelEditState = new ReadOnlyObjectWrapper<>(InlineLabelEditState.inactive());
        renderState = DungeonMapRenderState.empty(this.placeholderTitle, editorMode);
        showRenderScene(renderSceneContentPartModel.toSceneProjection(renderState, currentHoverTarget));
    }

    public ReadOnlyObjectProperty<CanvasState> canvasStateProperty() {
        return canvasState.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<InlineLabelEditState> inlineLabelEditStateProperty() {
        return inlineLabelEditState.getReadOnlyProperty();
    }

    public ReadOnlyDoubleProperty zoomProperty() {
        return viewportContentPartModel.zoomProperty();
    }

    CanvasState currentCanvasState() {
        return canvasState.get();
    }

    public InlineLabelEditState currentInlineLabelEditState() {
        return inlineLabelEditState.get();
    }

    InlineLabelEditorPresentation currentInlineLabelEditorPresentation() {
        return InlineLabelEditorPresentation.from(inlineLabelEditState.get(), currentViewport());
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
                pointerTargets,
                sceneX,
                sceneY,
                preferBoundary);
    }

    public void updateHoverTarget(PointerTarget target) {
        PointerTarget nextTarget = selectableHoverTarget(target);
        if (sameHoverTarget(nextTarget, currentHoverTarget)) {
            return;
        }
        currentHoverTarget = nextTarget;
        showRenderScene(renderSceneContentPartModel.toSceneProjection(renderState, currentHoverTarget));
    }

    public void clearHoverTarget() {
        updateHoverTarget(PointerTarget.empty());
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
        PointerTarget safeTarget = target == null ? PointerTarget.empty() : target;
        if (safeTarget.targetKind() != PointerTargetKind.LABEL) {
            return Optional.empty();
        }
        return labelForTarget(safeTarget).map(label -> new InlineLabelEditCandidate(
                safeTarget,
                label.label(),
                label.q(),
                label.r(),
                DungeonMapRenderSceneContentPartModel.SceneGeometry.Label.labelWidthScene(label),
                DungeonMapRenderSceneContentPartModel.SceneGeometry.Label.labelHeightScene(label),
                label.rotationDegrees()));
    }

    public void applyInlineLabelEditProjection(InlineLabelEditProjection projection) {
        inlineLabelEditState.set(InlineLabelEditState.fromProjection(projection));
    }

    public void applyEditorSurfaceFrame(
            DungeonEditorMapSurfaceSnapshot editorSnapshot,
            MapInteractionFrame interactionFrame
    ) {
        DungeonEditorMapSurfaceSnapshot safeSnapshot = editorSnapshot == null
                ? DungeonEditorMapSurfaceSnapshot.empty()
                : editorSnapshot;
        MapInteractionFrame safeFrame = interactionFrame == null ? MapInteractionFrame.empty() : interactionFrame;
        if (editorSurfaceSnapshotCurrent
                && safeSnapshot.equals(currentEditorSurfaceSnapshot)
                && safeFrame.equals(currentMapInteractionFrame)) {
            return;
        }
        currentEditorSurfaceSnapshot = safeSnapshot;
        currentMapInteractionFrame = safeFrame;
        editorSurfaceSnapshotCurrent = true;
        showRenderState(DungeonMapSnapshotMapper.mapEditorSurface(
                placeholderTitle,
                safeSnapshot,
                roomLabelPlacementContentPartModel,
                previewDiffContentPartModel), safeFrame);
    }

    public void applyTravelSnapshot(TravelDungeonSnapshot travelSnapshot) {
        editorSurfaceSnapshotCurrent = false;
        currentMapInteractionFrame = MapInteractionFrame.empty();
        showRenderState(DungeonMapSnapshotMapper.mapTravel(
                placeholderTitle,
                travelSnapshot,
                roomLabelPlacementContentPartModel), MapInteractionFrame.empty());
    }

    private void showRenderState(DungeonMapRenderState nextRenderState, MapInteractionFrame interactionFrame) {
        renderState = nextRenderState == null ? renderState : nextRenderState;
        MapInteractionFrame safeFrame = interactionFrame == null ? MapInteractionFrame.empty() : interactionFrame;
        pointerTargets = safeFrame.pointerTargets();
        currentHoverTarget = retainedHoverTarget(currentHoverTarget, pointerTargets);
        showRenderScene(renderSceneContentPartModel.toSceneProjection(renderState, currentHoverTarget));
    }

    private void showRenderScene(DungeonMapRenderSceneContentPartModel.RenderSceneProjection projection) {
        RenderScene renderScene = projection == null
                ? RenderScene.empty(placeholderTitle)
                : projection.renderScene();
        hitGeometryContentPartModel.update(projection == null ? null : projection.buckets(), renderState, renderScene);
        setCanvasState(canvasState.get().withRenderScene(
                renderScene,
                viewportContentPartModel.currentViewport()));
    }

    private List<DungeonMapHitGeometryContentPartModel.CanvasHit> hitsAt(double sceneX, double sceneY) {
        return hitGeometryContentPartModel.hitsAt(sceneX, sceneY, currentViewport().gridSize());
    }

    private Optional<DungeonMapRenderState.Label> labelForTarget(PointerTarget target) {
        for (DungeonMapRenderState.Label label : renderState.labels()) {
            if (sameLabelTarget(label, target)) {
                return Optional.of(label);
            }
        }
        return Optional.empty();
    }

    private static boolean sameLabelTarget(DungeonMapRenderState.Label label, PointerTarget target) {
        return label != null
                && target != null
                && label.ownerId() == target.ownerId()
                && label.clusterId() == target.clusterId()
                && label.labelKind().equals(target.labelKind())
                && label.topologyRef().equals(target.topologyRef());
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
        PointerTarget safeTarget = target == null ? PointerTarget.empty() : target;
        if (safeTarget.targetKind() == PointerTargetKind.EMPTY || safeTarget.isRoomLabelTarget()) {
            return PointerTarget.empty();
        }
        return safeTarget;
    }

    private static PointerTarget retainedHoverTarget(
            PointerTarget target,
            Map<String, PointerTarget> availableTargets
    ) {
        PointerTarget safeTarget = selectableHoverTarget(target);
        if (safeTarget.targetKind() == PointerTargetKind.EMPTY) {
            return PointerTarget.empty();
        }
        for (PointerTarget availableTarget : availableTargets.values()) {
            if (sameHoverTarget(safeTarget, availableTarget)) {
                return selectableHoverTarget(availableTarget);
            }
        }
        return PointerTarget.empty();
    }

    private static boolean sameHoverTarget(PointerTarget first, PointerTarget second) {
        PointerTarget safeFirst = selectableHoverTarget(first);
        PointerTarget safeSecond = selectableHoverTarget(second);
        if (safeFirst.targetKind() != safeSecond.targetKind()) {
            return false;
        }
        if (safeFirst.targetKind() == PointerTargetKind.HANDLE) {
            return safeFirst.handleRef().equals(safeSecond.handleRef());
        }
        if (safeFirst.targetKind() == PointerTargetKind.BOUNDARY) {
            return safeFirst.ownerId() == safeSecond.ownerId()
                    && Objects.equals(safeFirst.topologyRef(), safeSecond.topologyRef());
        }
        if (safeFirst.targetKind() == PointerTargetKind.LABEL) {
            return safeFirst.labelKind().equals(safeSecond.labelKind())
                    && safeFirst.ownerId() == safeSecond.ownerId()
                    && safeFirst.clusterId() == safeSecond.clusterId()
                    && Objects.equals(safeFirst.topologyRef(), safeSecond.topologyRef());
        }
        if (safeFirst.targetKind() == PointerTargetKind.CELL
                || safeFirst.targetKind() == PointerTargetKind.GRAPH_NODE) {
            return safeFirst.elementKind().equals(safeSecond.elementKind())
                    && safeFirst.ownerId() == safeSecond.ownerId()
                    && safeFirst.clusterId() == safeSecond.clusterId()
                    && Objects.equals(safeFirst.topologyRef(), safeSecond.topologyRef());
        }
        return safeFirst.equals(safeSecond);
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

    public record CanvasState(
            RenderScene renderScene,
            Viewport viewport
    ) {

        private static CanvasState initial(RenderScene renderScene, Viewport viewport) {
            return new CanvasState(
                    renderScene,
                    viewport);
        }

        private CanvasState withRenderScene(RenderScene nextRenderScene, Viewport nextViewport) {
            return new CanvasState(
                    nextRenderScene,
                    nextViewport);
        }

        private CanvasState withViewport(Viewport nextViewport) {
            return new CanvasState(renderScene, nextViewport);
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

        static InlineLabelEditState fromProjection(InlineLabelEditProjection projection) {
            InlineLabelEditProjection safeProjection = projection == null
                    ? InlineLabelEditProjection.inactive()
                    : projection;
            if (!safeProjection.active()) {
                return inactive();
            }
            return active(
                    pointerTargetFromProjection(safeProjection),
                    safeProjection.text(),
                    safeProjection.centerX(),
                    safeProjection.centerY(),
                    safeProjection.width(),
                    safeProjection.height(),
                    safeProjection.rotationDegrees());
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
            labelKind = normalizeKind(labelKind, EMPTY_LABEL_KIND);
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyKind = normalizeKind(topologyKind, EMPTY_KIND);
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

    private static PointerTarget pointerTargetFromProjection(InlineLabelEditProjection projection) {
        return PointerTarget.label(
                projection.labelKind(),
                projection.ownerId(),
                projection.clusterId(),
                new DungeonMapRenderState.TopologyRef(
                        projection.topologyKind(),
                        projection.topologyId()));
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

        private static InlineLabelEditorPresentation from(InlineLabelEditState editState, Viewport viewport) {
            InlineLabelEditState safeState = editState == null ? InlineLabelEditState.inactive() : editState;
            Viewport safeViewport = viewport == null ? Viewport.initial() : viewport;
            if (!safeState.active()) {
                return hidden();
            }
            double screenWidth = safeState.width() * safeViewport.gridSize();
            double screenHeight = Math.max(24.0, safeState.height() * safeViewport.gridSize());
            return new InlineLabelEditorPresentation(
                    true,
                    safeState.text(),
                    safeViewport.sceneToScreenX(safeState.centerX()) - screenWidth / 2.0,
                    safeViewport.sceneToScreenY(safeState.centerY()) - screenHeight / 2.0,
                    screenWidth,
                    screenHeight,
                    safeState.rotationDegrees());
        }

        private static InlineLabelEditorPresentation hidden() {
            return new InlineLabelEditorPresentation(false, "", 0.0, 0.0, 0.0, 0.0, 0.0);
        }

        InlineLabelEditorPresentation {
            text = text == null ? "" : text;
            width = Math.max(0.0, width);
            height = Math.max(0.0, height);
        }
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
            List<MapCanvasPolygonPrimitive> actors
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
                    List.of());
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
            return copyOf(surfaces);
        }

        @Override
        public List<BoundaryPrimitive> boundaries() {
            return copyOf(boundaries);
        }

        @Override
        public List<GlyphPrimitive> glyphs() {
            return copyOf(glyphs);
        }

        @Override
        public List<TextPrimitive> texts() {
            return copyOf(texts);
        }

        @Override
        public List<RelationPrimitive> relations() {
            return copyOf(relations);
        }

        @Override
        public List<MapCanvasPolygonPrimitive> actors() {
            return copyOf(actors);
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

    public record MapInteractionFrame(Map<String, PointerTarget> pointerTargets) {
        public MapInteractionFrame {
            pointerTargets = pointerTargets == null ? Map.of() : Map.copyOf(pointerTargets);
        }

        public static MapInteractionFrame empty() {
            return new MapInteractionFrame(Map.of());
        }
    }

    public record PointerProjection(
            String targetKind,
            String labelKind,
            String elementKind,
            long ownerId,
            long clusterId,
            String topologyKind,
            long topologyId,
            DungeonEditorHandleRef handleRef,
            BoundaryTarget boundaryRef
    ) {
        public PointerProjection {
            handleRef = handleRef == null ? DungeonEditorHandleRef.empty() : handleRef;
            boundaryRef = boundaryRef == null ? BoundaryTarget.empty() : boundaryRef;
        }
    }

    public record BoundaryProjection(
            String kind,
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
    }

    public enum PointerTargetKind {
        EMPTY,
        CELL,
        LABEL,
        GRAPH_NODE,
        HANDLE,
        BOUNDARY
    }

    public record PointerTarget(
            PointerTargetKind targetKind,
            String labelKind,
            String elementKind,
            long ownerId,
            long clusterId,
            DungeonMapRenderState.TopologyRef topologyRef,
            DungeonEditorHandleRef handleRef,
            BoundaryTarget boundaryRef
    ) {
        public PointerTarget {
            targetKind = targetKind == null ? PointerTargetKind.EMPTY : targetKind;
            labelKind = normalizeKind(labelKind, EMPTY_LABEL_KIND);
            elementKind = normalizeKind(elementKind, EMPTY_KIND);
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRef = topologyRef == null ? DungeonMapRenderState.TopologyRef.empty() : topologyRef;
            handleRef = handleRef == null ? DungeonEditorHandleRef.empty() : handleRef;
            boundaryRef = boundaryRef == null ? BoundaryTarget.empty() : boundaryRef;
        }

        public static PointerTarget empty() {
            return new PointerTarget(
                    PointerTargetKind.EMPTY,
                    EMPTY_LABEL_KIND,
                    EMPTY_KIND,
                    0L,
                    0L,
                    DungeonMapRenderState.TopologyRef.empty(),
                    DungeonEditorHandleRef.empty(),
                    BoundaryTarget.empty());
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
                    safeTopologyRef,
                    DungeonEditorHandleRef.empty(),
                    BoundaryTarget.empty());
        }

        public static PointerTarget prepared(PointerProjection projection) {
            PointerProjection safeProjection = projection == null
                    ? new PointerProjection(
                    EMPTY_KIND,
                    EMPTY_LABEL_KIND,
                    EMPTY_KIND,
                    0L,
                    0L,
                    EMPTY_KIND,
                    0L,
                    DungeonEditorHandleRef.empty(),
                    BoundaryTarget.empty())
                    : projection;
            return new PointerTarget(
                    pointerTargetKind(safeProjection.targetKind()),
                    safeProjection.labelKind(),
                    safeProjection.elementKind(),
                    safeProjection.ownerId(),
                    safeProjection.clusterId(),
                    new DungeonMapRenderState.TopologyRef(safeProjection.topologyKind(), safeProjection.topologyId()),
                    safeProjection.handleRef(),
                    safeProjection.boundaryRef());
        }

        public String topologyKind() {
            return topologyRef.kind();
        }

        public long topologyId() {
            return topologyRef.id();
        }

        public boolean isLabelTarget() {
            return targetKind == PointerTargetKind.LABEL;
        }

        public boolean isClusterLabelTarget() {
            return isLabelTarget() && CLUSTER_LABEL_KIND.equals(labelKind);
        }

        public boolean isRoomLabelTarget() {
            return isLabelTarget() && ROOM_LABEL_KIND.equals(labelKind);
        }
    }

    public record BoundaryTarget(
            String kind,
            String key,
            long ownerId,
            DungeonMapRenderState.TopologyRef topologyRef,
            double startQ,
            double startR,
            int startLevel,
            double endQ,
            double endR,
            int endLevel
    ) {
        public BoundaryTarget {
            kind = normalizeKind(kind, "WALL");
            key = key == null ? "" : key.strip();
            ownerId = Math.max(0L, ownerId);
            topologyRef = topologyRef == null ? DungeonMapRenderState.TopologyRef.empty() : topologyRef;
        }

        public static BoundaryTarget empty() {
            return new BoundaryTarget(
                    "WALL",
                    "",
                    0L,
                    DungeonMapRenderState.TopologyRef.empty(),
                    0.0,
                    0.0,
                    0,
                    0.0,
                    0.0,
                    0);
        }

        public static BoundaryTarget prepared(BoundaryProjection projection) {
            BoundaryProjection safeProjection = projection == null
                    ? new BoundaryProjection("WALL", "", 0L, EMPTY_KIND, 0L, 0.0, 0.0, 0, 0.0, 0.0, 0)
                    : projection;
            return new BoundaryTarget(
                    safeProjection.kind(),
                    safeProjection.key(),
                    safeProjection.ownerId(),
                    new DungeonMapRenderState.TopologyRef(safeProjection.topologyKind(), safeProjection.topologyId()),
                    safeProjection.startQ(),
                    safeProjection.startR(),
                    safeProjection.startLevel(),
                    safeProjection.endQ(),
                    safeProjection.endR(),
                    safeProjection.endLevel());
        }

        public String topologyKind() {
            return topologyRef.kind();
        }

        public long topologyId() {
            return topologyRef.id();
        }

    }

    private static PointerTargetKind pointerTargetKind(String value) {
        if (value == null || value.isBlank()) {
            return PointerTargetKind.EMPTY;
        }
        try {
            return PointerTargetKind.valueOf(value.trim());
        } catch (IllegalArgumentException ignored) {
            return PointerTargetKind.EMPTY;
        }
    }

    private static String normalizeKind(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }


// Snapshot-to-render-state mapping
    private static final class DungeonMapSnapshotMapper {

    private static final Map<DungeonEditorTool, String> TOOL_LABELS = createToolLabels();

    static DungeonMapRenderState mapEditorSurface(
            String placeholderTitle,
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel,
            DungeonMapPreviewDiffContentPartModel previewDiffContentPartModel
    ) {
        DungeonEditorMapSurfaceSnapshot safeSnapshot = snapshot == null
                ? DungeonEditorMapSurfaceSnapshot.empty()
                : snapshot;
        DungeonMapRenderState baseState = DungeonMapEditorSurfaceProjector.mapEditorSurface(
                placeholderTitle,
                safeSnapshot.surface(),
                safeSnapshot.selection(),
                safeSnapshot.preview(),
                roomLabelPlacementContentPartModel,
                previewDiffContentPartModel,
                true);
        return baseState.withViewMode(DungeonMapRenderState.ViewMode.fromEditor(safeSnapshot.viewMode()))
                .withOverlaySettings(toOverlaySettings(safeSnapshot.overlaySettings()))
                .withProjectionLevel(safeSnapshot.projectionLevel())
                .withSelectedTool(toolLabel(safeSnapshot.selectedTool()));
    }

    static DungeonMapRenderState mapTravel(
            String placeholderTitle,
            TravelDungeonSnapshot snapshot,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel
    ) {
        TravelDungeonSnapshot safeSnapshot = snapshot == null
                ? TravelDungeonSnapshot.empty()
                : snapshot;
        DungeonMapRenderState baseState = DungeonMapTravelFactsProjector.mapTravelSurface(
                placeholderTitle,
                safeSnapshot.travelSurface(),
                roomLabelPlacementContentPartModel);
        return baseState.withOverlaySettings(toOverlaySettings(safeSnapshot.overlaySettings()))
                .withProjectionLevel(safeSnapshot.projectionLevel())
                .withSelectedTool(DungeonMapRenderState.selectToolLabel());
    }

    private static DungeonMapRenderState.LevelOverlaySettings toOverlaySettings(
            DungeonOverlaySettings overlaySettings
    ) {
        DungeonOverlaySettings safeOverlay = overlaySettings == null
                ? DungeonOverlaySettings.defaults()
                : overlaySettings;
        return new DungeonMapRenderState.LevelOverlaySettings(
                DungeonMapRenderState.OverlayMode.fromKey(safeOverlay.modeKey()),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static String toolLabel(DungeonEditorTool selectedTool) {
        return TOOL_LABELS.getOrDefault(selectedTool, DungeonMapRenderState.selectToolLabel());
    }

    private static Map<DungeonEditorTool, String> createToolLabels() {
        Map<DungeonEditorTool, String> labels = new EnumMap<>(DungeonEditorTool.class);
        labels.put(DungeonEditorTool.SELECT, DungeonMapRenderState.selectToolLabel());
        labels.put(DungeonEditorTool.ROOM_PAINT, "Raum malen");
        labels.put(DungeonEditorTool.ROOM_DELETE, "Raum löschen");
        labels.put(DungeonEditorTool.WALL_CREATE, "Wand setzen");
        labels.put(DungeonEditorTool.WALL_DELETE, "Wand löschen");
        labels.put(DungeonEditorTool.DOOR_CREATE, "Tür setzen");
        labels.put(DungeonEditorTool.DOOR_DELETE, "Tür löschen");
        labels.put(DungeonEditorTool.CORRIDOR_CREATE, "Korridor erstellen");
        labels.put(DungeonEditorTool.CORRIDOR_DELETE, "Korridor löschen");
        labels.put(DungeonEditorTool.STAIR_CREATE, "Treppe erstellen");
        labels.put(DungeonEditorTool.STAIR_CREATE_SQUARE, "Treppe erstellen");
        labels.put(DungeonEditorTool.STAIR_CREATE_CIRCULAR, "Treppe erstellen");
        labels.put(DungeonEditorTool.STAIR_DELETE, "Treppe löschen");
        labels.put(DungeonEditorTool.TRANSITION_CREATE, "Übergang erstellen");
        labels.put(DungeonEditorTool.TRANSITION_DELETE, "Übergang löschen");
        labels.put(DungeonEditorTool.FEATURE_POI_CREATE, "POI erstellen");
        labels.put(DungeonEditorTool.FEATURE_OBJECT_CREATE, "Objekt erstellen");
        labels.put(DungeonEditorTool.FEATURE_ENCOUNTER_CREATE, "Encounter erstellen");
        labels.put(DungeonEditorTool.FEATURE_DELETE, "Feature löschen");
        return labels;
    }

    private static DungeonMapRenderState.CellKind featureCellKind(DungeonFeatureKind kind) {
        return switch (kind == null ? DungeonFeatureKind.STAIR : kind) {
            case TRANSITION -> DungeonMapRenderState.CellKind.TRANSITION;
            case STAIR -> DungeonMapRenderState.CellKind.STAIR;
            case OBJECT -> DungeonMapRenderState.CellKind.FEATURE_OBJECT;
            case ENCOUNTER -> DungeonMapRenderState.CellKind.FEATURE_ENCOUNTER;
            case POI -> DungeonMapRenderState.CellKind.FEATURE_POI;
        };
    }

    private static DungeonMapRenderState.CellKind featureCellKind(String kind) {
        return featureCellKind(featureKind(kind));
    }

    private static DungeonMapRenderState.MarkerKind featureMarkerKind(DungeonFeatureKind kind) {
        return switch (kind == null ? DungeonFeatureKind.STAIR : kind) {
            case TRANSITION -> DungeonMapRenderState.MarkerKind.WAYPOINT;
            case STAIR -> DungeonMapRenderState.MarkerKind.STAIR;
            case OBJECT -> DungeonMapRenderState.MarkerKind.FEATURE_OBJECT;
            case ENCOUNTER -> DungeonMapRenderState.MarkerKind.FEATURE_ENCOUNTER;
            case POI -> DungeonMapRenderState.MarkerKind.FEATURE_POI;
        };
    }

    private static DungeonMapRenderState.MarkerKind featureMarkerKind(String kind) {
        return featureMarkerKind(featureKind(kind));
    }

    private static String featureMarkerLabel(DungeonFeatureKind kind) {
        return switch (kind == null ? DungeonFeatureKind.STAIR : kind) {
            case TRANSITION -> "->";
            case STAIR -> "z";
            case OBJECT -> "O";
            case ENCOUNTER -> "E";
            case POI -> "P";
        };
    }

    private static String featureMarkerLabel(String kind) {
        return featureMarkerLabel(featureKind(kind));
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
}

    private static final class DungeonMapTravelFactsProjector {

    static DungeonMapRenderState mapTravelSurface(
            String placeholderTitle,
            @Nullable DungeonTravelSurfaceSnapshot surface,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel
    ) {
        if (surface == null) {
            return DungeonMapRenderState.empty(placeholderTitle, false);
        }
        DungeonMapSnapshot map = surface.map();
        List<DungeonMapRenderState.GraphNode> graphNodes = TravelGraph.graphNodes(map.areas());
        return new DungeonMapRenderState(
                surface.mapName(),
                true,
                map.width(),
                map.height(),
                DungeonMapRenderState.Topology.fromPublished(map.topology()),
                DungeonMapRenderState.ViewMode.grid(),
                DungeonMapRenderState.LevelOverlaySettings.off(),
                0,
                false,
                DungeonMapRenderState.selectToolLabel(),
                "No dungeon map geometry available.",
                TravelGeometry.cells(map),
                TravelGeometry.edges(map.boundaries()),
                TravelFeatureAnnotations.labels(
                        map.areas(),
                        map.features(),
                        roomLabelPlacementContentPartModel),
                TravelFeatureAnnotations.markers(map.features()),
                graphNodes,
                TravelGraph.fallbackGraphLinks(graphNodes),
                TravelParty.partyToken(surface));
    }

    private static final class TravelGeometry {

    private static List<DungeonMapRenderState.Cell> cells(DungeonMapSnapshot map) {
        List<DungeonMapRenderState.Cell> cells = new ArrayList<>();
        for (DungeonAreaSnapshot area : map.areas()) {
            appendAreaCells(cells, area);
        }
        for (DungeonFeatureSnapshot feature : map.features()) {
            for (DungeonCellRef cell : feature.cells()) {
                cells.add(new DungeonMapRenderState.Cell(
                        cell.q(),
                        cell.r(),
                        cell.level(),
                        feature.label(),
                        DungeonMapSnapshotMapper.featureCellKind(feature.kind()),
                        feature.id(),
                        0L,
                        topologyRef(feature.topologyRef()),
                        false,
                        false,
                        false,
                        false));
            }
        }
        return List.copyOf(cells);
    }

    private static List<DungeonMapRenderState.Cell> areaCells(DungeonAreaSnapshot area) {
        List<DungeonMapRenderState.Cell> cells = new ArrayList<>();
        appendAreaCells(cells, area);
        return List.copyOf(cells);
    }

    private static void appendAreaCells(List<DungeonMapRenderState.Cell> cells, DungeonAreaSnapshot area) {
        for (DungeonCellRef cell : area.cells()) {
            cells.add(new DungeonMapRenderState.Cell(
                    cell.q(),
                    cell.r(),
                    cell.level(),
                    area.label(),
                    area.kind() == DungeonAreaKind.CORRIDOR
                            ? DungeonMapRenderState.CellKind.CORRIDOR
                            : DungeonMapRenderState.CellKind.ROOM,
                    area.id(),
                    area.clusterId(),
                    topologyRef(area.topologyRef()),
                    false,
                    false,
                    false,
                    false));
        }
    }

    private static List<DungeonMapRenderState.Edge> edges(List<DungeonBoundarySnapshot> boundaries) {
        List<DungeonMapRenderState.Edge> edges = new ArrayList<>();
        for (DungeonBoundarySnapshot boundary : boundaries) {
            edges.add(new DungeonMapRenderState.Edge(
                    boundary.edge().from().q(),
                    boundary.edge().from().r(),
                    boundary.edge().to().q(),
                    boundary.edge().to().r(),
                    boundary.edge().from().level(),
                    "door".equalsIgnoreCase(boundary.kind())
                            ? DungeonMapRenderState.EdgeKind.DOOR
                            : DungeonMapRenderState.EdgeKind.WALL,
                    boundary.label(),
                    boundary.id(),
                    topologyRef(boundary.topologyRef()),
                    false,
                    false));
        }
        return List.copyOf(edges);
    }
}

    private static final class TravelFeatureAnnotations {

        private static List<DungeonMapRenderState.Label> labels(
                List<DungeonAreaSnapshot> areas,
                List<DungeonFeatureSnapshot> features,
                DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel
        ) {
            List<DungeonMapRenderState.Label> labels = new ArrayList<>();
            for (DungeonAreaSnapshot area : areas) {
                if (area.kind() == DungeonAreaKind.CORRIDOR) {
                    continue;
                }
                List<DungeonMapRenderState.Cell> areaCells = TravelGeometry.areaCells(area);
                if (areaCells.isEmpty()) {
                    continue;
                }
                labels.add(RoomLabelRenderElements.roomLabel(
                        area.label(),
                        area.id(),
                        area.clusterId(),
                        topologyRef(area.topologyRef()),
                        areaCells,
                        roomLabelPlacementContentPartModel,
                        false,
                        false));
            }
            for (DungeonFeatureSnapshot feature : features) {
                CellCenter center = centerOf(feature.cells());
                labels.add(new DungeonMapRenderState.Label(
                    feature.label(),
                    center.q(),
                    center.r(),
                    center.level(),
                    feature.id(),
                    0L,
                    topologyRef(feature.topologyRef()),
                    FEATURE_LABEL_KIND,
                    false,
                    false,
                    0.0,
                    0.0));
            }
            return List.copyOf(labels);
    }

    private static List<DungeonMapRenderState.Marker> markers(List<DungeonFeatureSnapshot> features) {
        List<DungeonMapRenderState.Marker> markers = new ArrayList<>();
        for (DungeonFeatureSnapshot feature : features) {
            CellCenter center = centerOf(feature.cells());
            markers.add(new DungeonMapRenderState.Marker(
                    DungeonMapSnapshotMapper.featureMarkerLabel(feature.kind()),
                    center.q(),
                    center.r(),
                    center.level(),
                    DungeonMapSnapshotMapper.featureMarkerKind(feature.kind()),
                    false,
                    EditorRenderElements.markerHandle(
                            (int) Math.floor(center.q()),
                            (int) Math.floor(center.r()),
                            center.level()),
                    false));
        }
        return List.copyOf(markers);
    }
}

    private static final class TravelGraph {

    private static List<DungeonMapRenderState.GraphNode> graphNodes(List<DungeonAreaSnapshot> areas) {
        List<DungeonMapRenderState.GraphNode> nodes = new ArrayList<>();
        for (DungeonAreaSnapshot area : areas) {
            if (area.cells().isEmpty()) {
                continue;
            }
            CellCenter center = centerOf(area.cells());
            nodes.add(new DungeonMapRenderState.GraphNode(
                    area.id(),
                    area.clusterId(),
                    area.label(),
                    center.q(),
                    center.r(),
                    false));
        }
        return List.copyOf(nodes);
    }

    private static List<DungeonMapRenderState.GraphLink> fallbackGraphLinks(
            List<DungeonMapRenderState.GraphNode> nodes
    ) {
        int maximumLinklessGraphNodeCount = 1;
        if (nodes.size() <= maximumLinklessGraphNodeCount) {
            return List.of();
        }
        List<DungeonMapRenderState.GraphLink> links = new ArrayList<>();
        for (int index = 1; index < nodes.size(); index++) {
            links.add(new DungeonMapRenderState.GraphLink(nodes.get(index - 1).id(), nodes.get(index).id(), false));
        }
        return List.copyOf(links);
    }
}

    private static final class TravelParty {

    private static DungeonMapRenderState.PartyToken partyToken(DungeonTravelSurfaceSnapshot surface) {
        if (surface.position() == null) {
            return null;
        }
        DungeonCellRef tile = surface.position().tile();
        return new DungeonMapRenderState.PartyToken(
                tile.q() + 0.5,
                tile.r() + 0.5,
                tile.level(),
                DungeonMapRenderState.Heading.fromEditor(surface.position().heading()),
                true);
    }
}

    private static DungeonMapRenderState.TopologyRef topologyRef(DungeonTopologyElementRef ref) {
        return ref == null
                ? DungeonMapRenderState.TopologyRef.empty()
                : new DungeonMapRenderState.TopologyRef(ref.kind().name(), ref.id());
    }

    private static CellCenter centerOf(List<DungeonCellRef> cells) {
        if (cells == null || cells.isEmpty()) {
            return new CellCenter(0.5, 0.5, 0);
        }
        double q = 0.0;
        double r = 0.0;
        int level = cells.getFirst().level();
        for (DungeonCellRef cell : cells) {
            q += cell.q() + 0.5;
            r += cell.r() + 0.5;
        }
        return new CellCenter(q / cells.size(), r / cells.size(), level);
    }

    private record CellCenter(double q, double r, int level) {
    }
}

    private static final class DungeonMapEditorSurfaceProjector {

    static DungeonMapRenderState mapEditorSurface(
            String placeholderTitle,
            @Nullable DungeonEditorSurface surface,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonEditorPreview preview,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel,
            DungeonMapPreviewDiffContentPartModel previewDiffContentPartModel,
            boolean editorMode
    ) {
        if (surface == null) {
            return DungeonMapRenderState.empty(placeholderTitle, editorMode);
        }
        DungeonEditorMapSnapshot map = surface.map();
        ProjectionAccumulator projection = assemble(
                map,
                surface.previewDiff(),
                selection == null ? DungeonEditorStateSnapshot.Selection.empty() : selection,
                preview == null ? DungeonEditorPreview.none() : preview,
                roomLabelPlacementContentPartModel,
                previewDiffContentPartModel == null
                        ? new DungeonMapPreviewDiffContentPartModel()
                        : previewDiffContentPartModel);
        return projection.renderState(surface, map, editorMode);
    }

    private static ProjectionAccumulator assemble(
            DungeonEditorMapSnapshot map,
            DungeonEditorPreviewDiff previewDiff,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonEditorPreview preview,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel,
            DungeonMapPreviewDiffContentPartModel previewDiffContentPartModel
    ) {
        ProjectionAccumulator projection = new ProjectionAccumulator();
        projection.addAreas(map, selection, roomLabelPlacementContentPartModel);
        projection.addClusterLabels(map, selection);
        projection.addPreviewAndBoundaries(map, selection, preview);
        projection.addFeatures(map, selection);
        projection.addHandles(map, selection, preview);
        projection.addPreviewDiff(
                previewDiffContentPartModel,
                previewDiff,
                selection,
                preview,
                roomLabelPlacementContentPartModel);
        projection.addFallbackGraphLinks();
        return projection;
    }

}

    interface EditorHandleVisibility {

        static boolean visibleCanvasHandle(
                DungeonEditorHandleRef ref,
                DungeonEditorStateSnapshot.Selection selection
        ) {
            if (ref.kind().isClusterLabel()
                    || ref.kind().isCorridorGeometryHandle()) {
                return false;
            }
            if (ref.kind().isDoor()) {
                return true;
            }
            return !ref.kind().isClusterDragHandle()
                    || selection != null
                    && selection.clusterSelection()
                    && selection.clusterId() == ref.clusterId();
        }
    }

    private interface EditorPreviewProjection {

        static void addEditorPreview(
                List<DungeonMapRenderState.Cell> cells,
                List<DungeonMapRenderState.Edge> edges,
                List<DungeonMapRenderState.Label> labels,
                List<DungeonMapRenderState.Marker> markers,
                DungeonEditorPreview preview
        ) {
            if (preview instanceof DungeonEditorPreview.ClusterBoundariesPreview boundaryEdges) {
                addBoundaryEdgesPreview(edges, boundaryEdges);
                return;
            }
            if (preview instanceof DungeonEditorPreview.StairCreatePreview stairCreatePreview) {
                addStairCreatePreview(cells, labels, markers, stairCreatePreview);
            }
        }

        static void addBoundaryEdgesPreview(
                List<DungeonMapRenderState.Edge> edges,
                DungeonEditorPreview.ClusterBoundariesPreview boundaryEdges
        ) {
            DungeonMapRenderState.EdgeKind kind = EditorElementKinds.boundaryKind(boundaryEdges.boundaryKind());
            for (DungeonEdgeRef edge : boundaryEdges.edges()) {
                if (EditorProjectionFacts.invalidEdge(edge)) {
                    continue;
                }
                edges.add(new DungeonMapRenderState.Edge(
                        edge.from().q(),
                        edge.from().r(),
                        edge.to().q(),
                        edge.to().r(),
                        edge.from().level(),
                        kind,
                        boundaryEdges.deleteMode() ? "Delete preview" : "Boundary preview",
                        boundaryEdges.clusterId(),
                        DungeonMapRenderState.TopologyRef.empty(),
                        false,
                        true));
            }
        }

        static void addStairCreatePreview(
                List<DungeonMapRenderState.Cell> cells,
                List<DungeonMapRenderState.Label> labels,
                List<DungeonMapRenderState.Marker> markers,
                DungeonEditorPreview.StairCreatePreview preview
        ) {
            if (preview.valid()) {
                return;
            }
            DungeonCellRef anchor = preview.anchor();
            DungeonCellRef end = preview.end();
            String label = stairPreviewLabel(preview.shapeName());
            addStairDraftCell(cells, labels, anchor, label);
            if (!anchor.equals(end)) {
                addStairDraftCell(cells, labels, end, "Treppen-Ziel");
            }
            markers.add(new DungeonMapRenderState.Marker(
                    "z",
                    anchor.q() + 0.5,
                    anchor.r() + 0.5,
                    anchor.level(),
                    DungeonMapRenderState.MarkerKind.STAIR,
                    false,
                    EditorRenderElements.markerHandle(
                            anchor.q(),
                            anchor.r(),
                            anchor.level()),
                    true));
        }

        static void addStairDraftCell(
                List<DungeonMapRenderState.Cell> cells,
                List<DungeonMapRenderState.Label> labels,
                DungeonCellRef cell,
                String label
        ) {
            cells.add(new DungeonMapRenderState.Cell(
                    cell.q(),
                    cell.r(),
                    cell.level(),
                    label,
                    DungeonMapRenderState.CellKind.STAIR,
                    0L,
                    0L,
                    DungeonMapRenderState.TopologyRef.empty(),
                    false,
                    false,
                    true,
                    false));
            DungeonMapStairPreviewLevelLabelContentPartModel.addLevelLabel(
                    labels,
                    cell,
                    0L,
                    DungeonMapRenderState.TopologyRef.empty());
        }

        static String stairPreviewLabel(String shapeName) {
            return switch (shapeName == null ? "" : shapeName.trim().toUpperCase(Locale.ROOT)) {
                case "SQUARE" -> "Treppen-Vorschau: Eckspirale";
                case "CIRCULAR" -> "Treppen-Vorschau: Rundspirale";
                default -> "Treppen-Vorschau: Gerade";
            };
        }
    }

    private interface RoomLabelRenderElements {

        static DungeonMapRenderState.Label roomLabel(
                String label,
                long ownerId,
                long clusterId,
                DungeonMapRenderState.TopologyRef topologyRef,
                List<DungeonMapRenderState.Cell> areaCells,
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
            return new DungeonMapRenderState.Label(
                    label,
                    placement.centerQ(),
                    placement.centerR(),
                    labelLevel,
                    ownerId,
                    clusterId,
                    topologyRef,
                    ROOM_LABEL_KIND,
                    selected,
                    preview,
                    placement.availableLengthScene(),
                    placement.rotationDegrees());
        }
    }

    interface EditorRenderElements {

    static DungeonMapRenderState.Cell cell(
            DungeonEditorMapSnapshot.Area area,
            DungeonCellRef cell,
            boolean selected,
            boolean preview,
            boolean destructive,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return new DungeonMapRenderState.Cell(
                cell.q() + deltaQ,
                cell.r() + deltaR,
                cell.level() + deltaLevel,
                area.label(),
                EditorElementKinds.areaKind(area),
                area.id(),
                EditorProjectionFacts.clusterId(area),
                EditorProjectionFacts.areaTopologyRef(area),
                selected,
                false,
                preview,
                destructive);
    }

    static DungeonMapRenderState.Cell featureCell(
            DungeonEditorMapSnapshot.Feature feature,
            DungeonCellRef cell,
            boolean selected
    ) {
        return featureCell(feature, cell, selected, false, false);
    }

    static DungeonMapRenderState.Cell featureCell(
            DungeonEditorMapSnapshot.Feature feature,
            DungeonCellRef cell,
            boolean selected,
            boolean preview,
            boolean destructive
    ) {
        return new DungeonMapRenderState.Cell(
                cell.q(),
                cell.r(),
                cell.level(),
                feature.label(),
                DungeonMapSnapshotMapper.featureCellKind(feature.kind()),
                feature.id(),
                0L,
                EditorProjectionFacts.featureTopologyRef(feature),
                selected,
                false,
                preview,
                destructive);
    }

    static DungeonMapRenderState.Edge edge(
            DungeonEditorMapSnapshot.Boundary boundary,
            int deltaQ,
            int deltaR,
            int deltaLevel,
            boolean preview,
            boolean selected
    ) {
        DungeonEdgeRef edge = boundary.edge();
        return new DungeonMapRenderState.Edge(
                edge.from().q() + deltaQ,
                edge.from().r() + deltaR,
                edge.to().q() + deltaQ,
                edge.to().r() + deltaR,
                edge.from().level() + deltaLevel,
                EditorElementKinds.boundaryKind(boundary.kind()),
                boundary.label(),
                boundary.id(),
                EditorProjectionFacts.topologyRef(boundary.topologyRef()),
                selected,
                preview);
    }

    static DungeonMapRenderState.Marker featureMarker(
            DungeonEditorMapSnapshot.Feature feature,
            EditorProjectionFacts.CellCenter center,
            int level,
            boolean selected
    ) {
        return featureMarker(feature, center, level, selected, false);
    }

    static DungeonMapRenderState.Marker featureMarker(
            DungeonEditorMapSnapshot.Feature feature,
            EditorProjectionFacts.CellCenter center,
            int level,
            boolean selected,
            boolean preview
    ) {
        return new DungeonMapRenderState.Marker(
                DungeonMapSnapshotMapper.featureMarkerLabel(feature.kind()),
                center.q(),
                center.r(),
                level,
                DungeonMapSnapshotMapper.featureMarkerKind(feature.kind()),
                selected,
                featureMarkerHandle(
                        feature,
                        (int) Math.floor(center.q()),
                        (int) Math.floor(center.r()),
                        level),
                preview);
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
                EditorSelectionFacts.selectedHandle(ref, selection),
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
        if (ref.kind().isDoor() && !EditorProjectionFacts.invalidEdge(ref.sourceEdge())) {
            renderMarkerQ = (ref.sourceEdge().from().q() + ref.sourceEdge().to().q()) / 2.0;
            renderMarkerR = (ref.sourceEdge().from().r() + ref.sourceEdge().to().r()) / 2.0;
        }
        HandleMarkerPresentation presentation = HandleMarkerPresentation.marker(
                ref.kind(),
                q,
                r,
                renderMarkerQ,
                renderMarkerR);
        return new DungeonMapRenderState.Marker(
                presentation.label(),
                presentation.q(),
                presentation.r(),
                level,
                EditorElementKinds.handleMarkerKind(ref.kind()),
                selected,
                markerHandle(ref, q, r, level),
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
                EditorProjectionFacts.topologyRef(ref.topologyRef()),
                CLUSTER_LABEL_KIND,
                selected,
                preview,
                0.0,
                0.0);
    }

    static DungeonMapRenderState.Label roomLabel(
            DungeonEditorMapSnapshot.Area area,
            List<DungeonMapRenderState.Cell> areaCells,
            DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel,
            boolean selected,
            boolean preview
    ) {
        return RoomLabelRenderElements.roomLabel(
                area.label(),
                area.id(),
                EditorProjectionFacts.clusterId(area),
                EditorProjectionFacts.areaTopologyRef(area),
                areaCells,
                roomLabelPlacementContentPartModel,
                selected,
                preview);
    }

    static DungeonMapRenderState.MarkerHandle markerHandle(
            int q,
            int r,
            int level
    ) {
        return new DungeonMapRenderState.MarkerHandle(null, q, r, level, null);
    }

    static DungeonMapRenderState.MarkerHandle markerHandle(
            DungeonMapRenderState.TopologyRef topologyRef,
            int q,
            int r,
            int level
    ) {
        return new DungeonMapRenderState.MarkerHandle(null, q, r, level, topologyRef);
    }

    static DungeonMapRenderState.MarkerHandle markerHandle(
            DungeonEditorHandleRef handle,
            int q,
            int r,
            int level
    ) {
        return new DungeonMapRenderState.MarkerHandle(handle, q, r, level, null);
    }

    static DungeonMapRenderState.MarkerHandle featureMarkerHandle(
            DungeonEditorMapSnapshot.Feature feature,
            int q,
            int r,
            int level
    ) {
        DungeonMapRenderState.TopologyRef topologyRef = EditorProjectionFacts.featureTopologyRef(feature);
        if (!"FEATURE_MARKER".equals(topologyRef.kind())) {
            return markerHandle(q, r, level);
        }
        return markerHandle(topologyRef, q, r, level);
    }

}
    interface EditorSelectionFacts {

    static boolean selectedArea(
            DungeonEditorMapSnapshot.Area area,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        if (selection == null) {
            return false;
        }
        if (selection.clusterSelection()) {
            return EditorElementKinds.areaKind(area) == DungeonMapRenderState.CellKind.ROOM && EditorProjectionFacts.clusterId(area) == selection.clusterId();
        }
        return EditorProjectionFacts.areaTopologyRef(area).equals(EditorProjectionFacts.topologyRef(selection.topologyRef()));
    }

    static boolean selectedAreaSurface(
            DungeonEditorMapSnapshot.Area area,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        return selection != null
                && !selection.clusterSelection()
                && EditorProjectionFacts.areaTopologyRef(area).equals(EditorProjectionFacts.topologyRef(selection.topologyRef()));
    }

    static boolean selectedFeature(
            DungeonEditorMapSnapshot.Feature feature,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        return EditorProjectionFacts.featureTopologyRef(feature).equals(EditorProjectionFacts.topologyRef(selection.topologyRef()));
    }

    static boolean selectedBoundary(
            DungeonEditorMapSnapshot.Boundary boundary,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        return EditorProjectionFacts.topologyRef(boundary.topologyRef()).equals(
                EditorProjectionFacts.topologyRef(selection.topologyRef()));
    }

    static boolean selectedHandle(
            DungeonEditorHandleRef ref,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        DungeonEditorHandleRef selected = selection.handleRef();
        return selected != null
                && EditorProjectionFacts.sameHandleRef(ref, selected);
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

}

    private interface EditorElementKinds {

    static DungeonMapRenderState.CellKind areaKind(DungeonEditorMapSnapshot.Area area) {
        return "CORRIDOR".equalsIgnoreCase(area.kind())
                ? DungeonMapRenderState.CellKind.CORRIDOR
                : DungeonMapRenderState.CellKind.ROOM;
    }

    static DungeonMapRenderState.EdgeKind boundaryKind(String kind) {
        return "DOOR".equalsIgnoreCase(kind) ? DungeonMapRenderState.EdgeKind.DOOR : DungeonMapRenderState.EdgeKind.WALL;
    }

    static DungeonMapRenderState.MarkerKind handleMarkerKind(DungeonEditorHandleKind kind) {
        if (kind == DungeonEditorHandleKind.DOOR) {
            return DungeonMapRenderState.MarkerKind.DOOR;
        }
        if (kind == DungeonEditorHandleKind.STAIR_ANCHOR) {
            return DungeonMapRenderState.MarkerKind.STAIR;
        }
        if (kind == DungeonEditorHandleKind.CLUSTER_WALL_RUN) {
            return DungeonMapRenderState.MarkerKind.CLUSTER;
        }
        return DungeonMapRenderState.MarkerKind.WAYPOINT;
    }

}

    private record HandleMarkerPresentation(String label, double q, double r) {

        static HandleMarkerPresentation marker(
                DungeonEditorHandleKind kind,
                int q,
                int r,
                double markerQ,
                double markerR
        ) {
            return new HandleMarkerPresentation(
                    label(kind),
                    markerQ(kind, q, markerQ),
                    markerR(kind, r, markerR));
        }

        private static double markerQ(DungeonEditorHandleKind kind, int coordinate, double markerQ) {
            if (kind == DungeonEditorHandleKind.CLUSTER_WALL_RUN || kind == DungeonEditorHandleKind.DOOR) {
                return markerQ;
            }
            return kind == DungeonEditorHandleKind.CLUSTER_CORNER ? coordinate : coordinate + 0.5;
        }

        private static double markerR(DungeonEditorHandleKind kind, int coordinate, double markerR) {
            if (kind == DungeonEditorHandleKind.CLUSTER_WALL_RUN || kind == DungeonEditorHandleKind.DOOR) {
                return markerR;
            }
            return kind == DungeonEditorHandleKind.CLUSTER_CORNER ? coordinate : coordinate + 0.5;
        }

        private static String label(DungeonEditorHandleKind kind) {
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

    interface EditorProjectionFacts {

    static DungeonMapRenderState.TopologyRef areaTopologyRef(DungeonEditorMapSnapshot.Area area) {
        return topologyRef(area.topologyRef());
    }

    static DungeonMapRenderState.TopologyRef featureTopologyRef(DungeonEditorMapSnapshot.Feature feature) {
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

    static CellCenter centerOfCells(List<DungeonMapRenderState.Cell> cells) {
        double q = 0.0;
        double r = 0.0;
        for (DungeonMapRenderState.Cell cell : cells) {
            q += cell.q() + 0.5;
            r += cell.r() + 0.5;
        }
        int count = Math.max(1, cells.size());
        return new CellCenter(q / count, r / count);
    }

    static DungeonMapRenderState.TopologyRef topologyRef(
            src.domain.dungeon.published.DungeonEditorTopologyElementRef ref
    ) {
        return ref == null
                ? DungeonMapRenderState.TopologyRef.empty()
                : new DungeonMapRenderState.TopologyRef(ref.kind(), ref.id());
    }

    static DungeonMapRenderState.TopologyRef topologyRef(DungeonTopologyElementRef ref) {
        return ref == null
                ? DungeonMapRenderState.TopologyRef.empty()
                : new DungeonMapRenderState.TopologyRef(ref.kind().name(), ref.id());
    }

    record CellCenter(double q, double r) {
    }
}

    private static final class ProjectionAccumulator {
        private final List<DungeonMapRenderState.Cell> cells = new ArrayList<>();
        private final List<DungeonMapRenderState.Edge> edges = new ArrayList<>();
        private final List<DungeonMapRenderState.Label> labels = new ArrayList<>();
        private final List<DungeonMapRenderState.Marker> markers = new ArrayList<>();
        private final List<DungeonMapRenderState.GraphNode> graphNodes = new ArrayList<>();
        private final List<DungeonMapRenderState.GraphLink> graphLinks = new ArrayList<>();

        private void addAreas(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection,
                DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel
        ) {
            for (DungeonEditorMapSnapshot.Area area : map.areas()) {
                addArea(
                        area,
                        EditorSelectionFacts.selectedAreaSurface(area, selection),
                        EditorSelectionFacts.selectedArea(area, selection),
                        roomLabelPlacementContentPartModel);
            }
        }

        private void addArea(
                DungeonEditorMapSnapshot.Area area,
                boolean surfaceSelected,
                boolean annotationSelected,
                DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel
        ) {
            List<DungeonMapRenderState.Cell> areaCells = new ArrayList<>();
            for (DungeonCellRef cell : area.cells()) {
                areaCells.add(EditorRenderElements.cell(area, cell, surfaceSelected, false, false, 0, 0, 0));
            }
            cells.addAll(areaCells);
            if (areaCells.isEmpty()) {
                return;
            }
            EditorProjectionFacts.CellCenter center =
                    EditorProjectionFacts.centerOfCells(areaCells);
            graphNodes.add(new DungeonMapRenderState.GraphNode(
                    area.id(),
                    EditorProjectionFacts.clusterId(area),
                    area.label(),
                    center.q(),
                    center.r(),
                    annotationSelected));
            if (EditorElementKinds.areaKind(area) == DungeonMapRenderState.CellKind.ROOM) {
                labels.add(EditorRenderElements.roomLabel(
                        area,
                        areaCells,
                        roomLabelPlacementContentPartModel,
                        annotationSelected,
                        false));
            }
        }

        private void addClusterLabels(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection
        ) {
            List<Long> renderedClusterIds = new ArrayList<>();
            for (DungeonEditorHandleSnapshot handle : map.editorHandles()) {
                if (!handle.ref().kind().isClusterLabel()) {
                    continue;
                }
                long clusterId = handle.ref().clusterId();
                if (clusterId <= 0L || renderedClusterIds.contains(clusterId)) {
                    continue;
                }
                renderedClusterIds.add(clusterId);
                labels.add(EditorRenderElements.clusterLabel(
                        handle,
                        EditorSelectionFacts.selectedClusterLabel(handle, selection),
                        false,
                        0,
                        0,
                        0));
            }
        }

        private void addPreviewAndBoundaries(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection,
                DungeonEditorPreview preview
        ) {
            EditorPreviewProjection.addEditorPreview(cells, edges, labels, markers, preview);
            for (DungeonEditorMapSnapshot.Boundary boundary : map.boundaries()) {
                if (EditorProjectionFacts.invalidEdge(boundary.edge())) {
                    continue;
                }
                edges.add(EditorRenderElements.edge(
                        boundary,
                        0,
                        0,
                        0,
                        false,
                        EditorSelectionFacts.selectedBoundary(boundary, selection)));
            }
        }

        private void addFeatures(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection
        ) {
            for (DungeonEditorMapSnapshot.Feature feature : map.features()) {
                addFeature(feature, EditorSelectionFacts.selectedFeature(feature, selection));
            }
        }

        private void addFeature(
                DungeonEditorMapSnapshot.Feature feature,
                boolean selected
        ) {
            List<DungeonMapRenderState.Cell> featureCells = new ArrayList<>();
            for (DungeonCellRef cell : feature.cells()) {
                featureCells.add(EditorRenderElements.featureCell(feature, cell, selected));
            }
            cells.addAll(featureCells);
            if (featureCells.isEmpty()) {
                return;
            }
            EditorProjectionFacts.CellCenter center =
                    EditorProjectionFacts.centerOfCells(featureCells);
            labels.add(new DungeonMapRenderState.Label(
                    feature.label(),
                    center.q(),
                    center.r(),
                    featureCells.getFirst().z(),
                    feature.id(),
                    0L,
                    EditorProjectionFacts.featureTopologyRef(feature),
                    FEATURE_LABEL_KIND,
                    selected,
                    false,
                    0.0,
                    0.0));
            markers.add(EditorRenderElements.featureMarker(
                    feature,
                    center,
                    featureCells.getFirst().z(),
                    selected));
        }

        private void addHandles(
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection,
                DungeonEditorPreview preview
        ) {
            for (DungeonEditorHandleSnapshot handle : map.editorHandles()) {
                if (!EditorHandleVisibility.visibleCanvasHandle(handle.ref(), selection)) {
                    continue;
                }
                if (movingPreviewHandle(handle.ref(), preview)) {
                    continue;
                }
                markers.add(EditorRenderElements.handleMarker(handle, selection, false));
            }
        }

        private static boolean movingPreviewHandle(DungeonEditorHandleRef ref, DungeonEditorPreview preview) {
            return preview instanceof DungeonEditorPreview.MoveHandlePreview handlePreview
                    && EditorProjectionFacts.sameHandleRef(ref, handlePreview.handleRef());
        }

        private void addPreviewDiff(
                DungeonMapPreviewDiffContentPartModel previewDiffContentPartModel,
                DungeonEditorPreviewDiff previewDiff,
                DungeonEditorStateSnapshot.Selection selection,
                DungeonEditorPreview preview,
                DungeonMapRoomLabelPlacementContentPartModel roomLabelPlacementContentPartModel
        ) {
            if (!structuredPreviewDiffOwner(preview)) {
                return;
            }
            previewDiffContentPartModel.addPreviewDiff(
                    cells,
                    edges,
                    labels,
                    markers,
                    previewDiff,
                    selection,
                    roomLabelPlacementContentPartModel);
        }

        private static boolean structuredPreviewDiffOwner(DungeonEditorPreview preview) {
            return !(preview instanceof DungeonEditorPreview.ClusterBoundariesPreview);
        }

        private void addFallbackGraphLinks() {
            if (!graphLinks.isEmpty() || graphNodes.size() <= 1) {
                return;
            }
            for (int index = 1; index < graphNodes.size(); index++) {
                graphLinks.add(new DungeonMapRenderState.GraphLink(
                        graphNodes.get(index - 1).id(),
                        graphNodes.get(index).id(),
                        false));
            }
        }

        private DungeonMapRenderState renderState(
                DungeonEditorSurface surface,
                DungeonEditorMapSnapshot map,
                boolean editorMode
        ) {
            return new DungeonMapRenderState(
                    surface.mapName(),
                    true,
                    map.width(),
                    map.height(),
                    DungeonMapRenderState.Topology.fromName(map.topology()),
                    DungeonMapRenderState.ViewMode.grid(),
                    DungeonMapRenderState.LevelOverlaySettings.off(),
                    0,
                    editorMode,
                    DungeonMapRenderState.selectToolLabel(),
                    "No dungeon map geometry available.",
                    List.copyOf(cells),
                    List.copyOf(edges),
                    List.copyOf(labels),
                    List.copyOf(markers),
                    List.copyOf(graphNodes),
                    List.copyOf(graphLinks),
                    null);
        }
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
                return EditorProjectionFacts.topologyRef(ref.topologyRef());
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

    private static String selectToolLabel() {
        return "Auswahl";
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
