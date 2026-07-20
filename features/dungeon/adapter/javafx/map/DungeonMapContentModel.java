package features.dungeon.adapter.javafx.map;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import javafx.beans.property.ReadOnlyDoubleProperty;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import features.dungeon.api.DungeonEditorHandleRef;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.TravelDungeonSnapshot;
import features.dungeon.api.editor.DungeonEditorDraftState;
import features.dungeon.api.editor.DungeonEditorPointerInput;
import features.dungeon.api.editor.DungeonEditorState;
import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.api.editor.DungeonEditorToolSelection;

public final class DungeonMapContentModel {

    private static final String EMPTY_KIND = "EMPTY";
    private static final String EMPTY_LABEL_KIND = EMPTY_KIND;

    private final String placeholderTitle;
    private final ReadOnlyObjectWrapper<CanvasState> canvasState;
    private final DungeonMapInlineLabelState inlineLabelState =
            new DungeonMapInlineLabelState();
    private final DungeonMapSceneAssembler sceneAssembler =
            new DungeonMapSceneAssembler();
    private final DungeonMapViewportState viewportState =
            new DungeonMapViewportState();
    private final DungeonMapHitIndex hitIndex =
            new DungeonMapHitIndex();
    private final DungeonMapFrameConsumption frameConsumption =
            new DungeonMapFrameConsumption();
    private final DungeonMapFrameProjector frameProjector =
            new DungeonMapFrameProjector();
    private DungeonMapRenderState renderState;
    private DungeonEditorState currentEditorState = DungeonEditorState.empty();

    // Public ContentModel API

    public DungeonMapContentModel(String placeholderTitle, boolean editorMode) {
        this.placeholderTitle = normalizePlaceholderTitle(placeholderTitle);
        canvasState = new ReadOnlyObjectWrapper<>(CanvasState.initial(
                RenderScene.empty(this.placeholderTitle),
                viewportState.currentViewport()));
        renderState = DungeonMapRenderState.empty(this.placeholderTitle, editorMode);
        showRenderScene(rebuildRenderSceneProjection(PointerTarget.empty()), true);
    }

    public ReadOnlyObjectProperty<CanvasState> canvasStateProperty() {
        return canvasState.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<InlineLabelEditState> inlineLabelEditStateProperty() {
        return inlineLabelState.inlineLabelEditStateProperty();
    }

    public ReadOnlyDoubleProperty zoomProperty() {
        return viewportState.zoomProperty();
    }

    CanvasState currentCanvasState() {
        return canvasState.get();
    }

    public InlineLabelEditState currentInlineLabelEditState() {
        return inlineLabelState.currentInlineLabelEditState();
    }

    InlineLabelEditorPresentation currentInlineLabelEditorPresentation() {
        return inlineLabelState.currentInlineLabelEditorPresentation(currentViewport());
    }

    public Viewport currentViewport() {
        return viewportState.currentViewport();
    }

    public double currentZoom() {
        return viewportState.currentZoom();
    }

    static String defaultTitle() {
        return "Dungeon Map";
    }

    public void resetCamera() {
        refreshCanvasViewport(viewportState.resetCamera());
    }

    public void panByPixels(double deltaX, double deltaY) {
        refreshCanvasViewport(viewportState.panByPixels(deltaX, deltaY));
    }

    public void zoomAround(double canvasX, double canvasY, double factor) {
        refreshCanvasViewport(viewportState.zoomAround(canvasX, canvasY, factor));
    }

    public List<PointerTarget> pointerTargetsAt(double sceneX, double sceneY) {
        return hitsAt(sceneX, sceneY).stream()
                .map(DungeonMapHitIndex.CanvasHit::pointerTarget)
                .toList();
    }

    public boolean partyTokenTargetAt(double sceneX, double sceneY) {
        return pointerTargetsAt(sceneX, sceneY).stream().anyMatch(PointerTarget::isPartyTokenTarget);
    }

    public Optional<DungeonCellRef> exactDungeonCellAt(double sceneX, double sceneY) {
        return pointerTargetsAt(sceneX, sceneY).stream()
                .filter(PointerTarget::isCellTarget)
                .map(PointerTarget::cellRef)
                .filter(CellTarget::exact)
                .map(cell -> new DungeonCellRef(cell.q(), cell.r(), cell.level()))
                .findFirst();
    }

    public PointerTarget syntheticHoverTarget(
            DungeonEditorToolSelection toolSelection,
            boolean wallSingleClick,
            double sceneX,
            double sceneY,
            int level
    ) {
        DungeonEditorToolFamily family = toolSelection == null
                ? DungeonEditorToolFamily.SELECT
                : toolSelection.family();
        if (family == DungeonEditorToolFamily.ROOM) {
            return PointerTarget.syntheticCell(PreparedElementKind.ROOM,
                    (int) Math.floor(sceneX), (int) Math.floor(sceneY), level);
        }
        if (family == DungeonEditorToolFamily.WALL && !wallSingleClick) {
            return PointerTarget.syntheticVertex((int) Math.round(sceneX), (int) Math.round(sceneY), level);
        }
        if (family == DungeonEditorToolFamily.WALL || family == DungeonEditorToolFamily.DOOR) {
            int q = (int) Math.floor(sceneX);
            int r = (int) Math.floor(sceneY);
            double localQ = sceneX - q;
            double localR = sceneY - r;
            if (Math.min(localQ, 1.0 - localQ) < Math.min(localR, 1.0 - localR)) {
                int edgeQ = localQ < 0.5 ? q : q + 1;
                return PointerTarget.syntheticBoundary(edgeQ, r, edgeQ, r + 1, level);
            }
            int edgeR = localR < 0.5 ? r : r + 1;
            return PointerTarget.syntheticBoundary(q, edgeR, q + 1, edgeR, level);
        }
        return PointerTarget.syntheticCell(PreparedElementKind.EMPTY,
                (int) Math.floor(sceneX), (int) Math.floor(sceneY), level);
    }

    public void updateHoverTarget(PointerTarget target) {
        if (!frameConsumption.updateHoverTarget(target)) {
            return;
        }
        PointerTarget hoverTarget = frameConsumption.currentHoverTarget();
        showHoverOverlay(hoverTarget);
    }

    public void clearHoverTarget() {
        if (!frameConsumption.clearHoverTarget()) {
            return;
        }
        publishHoverOverlay(DungeonMapSceneAssembler.SceneBuckets.empty());
    }

    public Optional<InlineLabelEditCandidate> inlineLabelEditCandidate(PointerTarget target) {
        return inlineLabelState.inlineLabelEditCandidate(
                inlineLabelEditPresentationKey(target),
                renderState.labels());
    }

    public void beginInlineLabelEdit(PointerTarget target, InlineLabelEditCandidate candidate) {
        PointerTarget safeTarget = target == null ? PointerTarget.empty() : target;
        InlineLabelEditCandidate safeCandidate = candidate == null
                ? new InlineLabelEditCandidate("", 0.0, 0.0, 1.0, 0.6, 0.0)
                : candidate;
        inlineLabelState.applyInlineLabelEditProjection(new InlineLabelEditProjection(
                safeTarget.isLabelTarget(),
                safeTarget.labelKind().name(),
                safeTarget.ownerId(),
                safeTarget.clusterId(),
                safeTarget.topologyKind().name(),
                safeTarget.topologyId(),
                safeCandidate.text(),
                safeCandidate.centerX(),
                safeCandidate.centerY(),
                safeCandidate.width(),
                safeCandidate.height(),
                safeCandidate.rotationDegrees()));
    }

    public void updateInlineLabelEditText(String text) {
        InlineLabelEditState state = currentInlineLabelEditState();
        if (state == null || !state.active()) {
            return;
        }
        inlineLabelState.applyInlineLabelEditProjection(new InlineLabelEditProjection(
                true,
                state.target().labelKind().name(),
                state.target().ownerId(),
                state.target().clusterId(),
                state.target().topologyKind().name(),
                state.target().topologyId(),
                text,
                state.centerX(),
                state.centerY(),
                state.width(),
                state.height(),
                state.rotationDegrees()));
    }

    public void cancelInlineLabelEdit() {
        inlineLabelState.applyInlineLabelEditProjection(InlineLabelEditProjection.inactive());
    }

    public void applyEditorState(DungeonEditorState state) {
        DungeonEditorState safeState = state == null ? DungeonEditorState.empty() : state;
        currentEditorState = safeState;
        showRenderState(frameProjector.mapEditorSurface(placeholderTitle, safeState));
    }

    public long appliedPublicationRevision() {
        return currentEditorState.publicationRevision();
    }

    public void applyTravelSnapshot(TravelDungeonSnapshot travelSnapshot) {
        showRenderState(frameProjector.mapTravel(
                placeholderTitle,
                travelSnapshot));
    }

    private static InlineLabelEditPresentationKey inlineLabelEditPresentationKey(PointerTarget target) {
        PointerTarget safeTarget = target == null ? PointerTarget.empty() : target;
        if (!safeTarget.isLabelTarget()) {
            return InlineLabelEditPresentationKey.empty();
        }
        return new InlineLabelEditPresentationKey(
                safeTarget.labelKind(),
                safeTarget.ownerId(),
                safeTarget.clusterId(),
                safeTarget.topologyKind(),
                safeTarget.topologyId());
    }

    private void showRenderState(DungeonMapRenderState nextRenderState) {
        renderState = nextRenderState == null ? renderState : nextRenderState;
        frameConsumption.clearHoverTarget();
        showRenderScene(rebuildRenderSceneProjection(PointerTarget.empty()), true);
    }

    private DungeonMapSceneAssembler.RenderSceneProjection rebuildRenderSceneProjection(
            PointerTarget hoverTarget
    ) {
        return sceneAssembler.toSceneProjection(renderState, hoverTarget);
    }

    private void showRenderScene(
            DungeonMapSceneAssembler.RenderSceneProjection projection,
            boolean rebuildHitGeometry
    ) {
        RenderScene renderScene = projection == null
                ? RenderScene.empty(placeholderTitle)
                : projection.renderScene();
        if (rebuildHitGeometry) {
            hitIndex.update(
                    projection == null ? null : projection.buckets(),
                    renderState,
                    renderScene);
        }
        setCanvasState(canvasState.get().withRenderScene(
                renderScene,
                viewportState.currentViewport()));
    }

    private void showHoverOverlay(PointerTarget hoverTarget) {
        DungeonMapSceneAssembler.SceneBuckets hoverOverlay =
                sceneAssembler.toHoverOverlay(renderState, hoverTarget);
        publishHoverOverlay(hoverOverlay);
    }

    private void publishHoverOverlay(DungeonMapSceneAssembler.SceneBuckets hoverOverlay) {
        setCanvasState(canvasState.get().withHoverOverlay(
                hoverOverlay,
                viewportState.currentViewport()));
    }

    private List<DungeonMapHitIndex.CanvasHit> hitsAt(double sceneX, double sceneY) {
        return hitIndex.hitsAt(sceneX, sceneY, currentViewport().gridSize());
    }

    static PreparedElementKind preparedCellElementKind(DungeonMapRenderState.CellKind kind) {
        if (kind == null) {
            return PreparedElementKind.EMPTY;
        }
        return switch (kind) {
            case ROOM -> PreparedElementKind.ROOM;
            case CORRIDOR -> PreparedElementKind.CORRIDOR;
            case STAIR -> PreparedElementKind.STAIR;
            case TRANSITION -> PreparedElementKind.TRANSITION;
            case FEATURE_POI, FEATURE_OBJECT, FEATURE_ENCOUNTER -> PreparedElementKind.FEATURE_MARKER;
        };
    }

    private static PreparedElementKind preparedElementKind(PreparedTopologyKind topologyKind) {
        return switch (topologyKind == null ? PreparedTopologyKind.EMPTY : topologyKind) {
            case ROOM -> PreparedElementKind.ROOM;
            case CORRIDOR -> PreparedElementKind.CORRIDOR;
            case CORRIDOR_ANCHOR -> PreparedElementKind.CORRIDOR_ANCHOR;
            case DOOR -> PreparedElementKind.DOOR;
            case WALL -> PreparedElementKind.WALL;
            case STAIR -> PreparedElementKind.STAIR;
            case TRANSITION -> PreparedElementKind.TRANSITION;
            case FEATURE_MARKER -> PreparedElementKind.FEATURE_MARKER;
            default -> PreparedElementKind.EMPTY;
        };
    }

    static PointerTarget selectableHoverTarget(PointerTarget target) {
        return DungeonMapFrameConsumption.selectableHoverTarget(target);
    }

    private void setCanvasState(CanvasState nextState) {
        if (canvasState.get().sameAs(nextState)) {
            return;
        }
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
        private final DungeonMapSceneAssembler.SceneBuckets hoverOverlay;
        private final Viewport viewport;
        private final long baseRevision;
        private final long interactionRevision;
        private final long actorRevision;

        static CanvasState initial(RenderScene renderScene, Viewport viewport) {
            return new CanvasState(
                renderScene,
                    DungeonMapSceneAssembler.SceneBuckets.empty(),
                    viewport,
                    1L,
                    1L,
                    1L);
        }

        private CanvasState(
                RenderScene renderScene,
                DungeonMapSceneAssembler.SceneBuckets hoverOverlay,
                Viewport viewport,
                long baseRevision,
                long interactionRevision,
                long actorRevision
        ) {
            this.renderScene = renderScene == null ? RenderScene.empty(defaultTitle()) : renderScene;
            this.hoverOverlay = hoverOverlay == null
                    ? DungeonMapSceneAssembler.SceneBuckets.empty()
                    : hoverOverlay;
            this.viewport = viewport == null ? Viewport.initial() : viewport;
            this.baseRevision = Math.max(0L, baseRevision);
            this.interactionRevision = Math.max(0L, interactionRevision);
            this.actorRevision = Math.max(0L, actorRevision);
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

        public long baseRevision() {
            return baseRevision;
        }

        public long interactionRevision() {
            return interactionRevision;
        }

        public long actorRevision() {
            return actorRevision;
        }

        CanvasState withRenderScene(RenderScene nextRenderScene, Viewport nextViewport) {
            RenderScene safeNext = nextRenderScene == null ? RenderScene.empty(defaultTitle()) : nextRenderScene;
            boolean viewportChanged = !Objects.equals(viewport, nextViewport);
            return new CanvasState(
                    safeNext,
                    DungeonMapSceneAssembler.SceneBuckets.empty(),
                    nextViewport,
                    incrementIf(baseRevision, viewportChanged || !renderScene.sameBasePaint(safeNext)),
                    incrementIf(interactionRevision,
                            viewportChanged
                                    || !renderScene.sameInteractionPaint(safeNext)
                                    || !hoverOverlay.equals(DungeonMapSceneAssembler.SceneBuckets.empty())),
                    incrementIf(actorRevision, viewportChanged || !renderScene.sameActorPaint(safeNext)));
        }

        CanvasState withHoverOverlay(
                DungeonMapSceneAssembler.SceneBuckets nextHoverOverlay,
                Viewport nextViewport
        ) {
            return new CanvasState(
                    renderScene,
                    nextHoverOverlay,
                    nextViewport,
                    incrementIf(baseRevision, !Objects.equals(viewport, nextViewport)),
                    incrementIf(interactionRevision,
                            !Objects.equals(viewport, nextViewport)
                                    || !Objects.equals(hoverOverlay, nextHoverOverlay)),
                    incrementIf(actorRevision, !Objects.equals(viewport, nextViewport)));
        }

        private CanvasState withRenderSceneMetadata(RenderScene nextRenderScene, Viewport nextViewport) {
            return withRenderScene(nextRenderScene, nextViewport);
        }

        CanvasState withViewport(Viewport nextViewport) {
            boolean changed = !Objects.equals(viewport, nextViewport);
            return new CanvasState(
                    renderScene,
                    hoverOverlay,
                    nextViewport,
                    incrementIf(baseRevision, changed),
                    incrementIf(interactionRevision, changed),
                    incrementIf(actorRevision, changed));
        }

        private boolean sameAs(CanvasState other) {
            return other != null
                    && Objects.equals(renderScene, other.renderScene)
                    && Objects.equals(hoverOverlay, other.hoverOverlay)
                    && Objects.equals(viewport, other.viewport)
                    && baseRevision == other.baseRevision
                    && interactionRevision == other.interactionRevision
                    && actorRevision == other.actorRevision;
        }

        private static long incrementIf(long revision, boolean changed) {
            return changed ? revision + 1L : revision;
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
            String text,
            double centerX,
            double centerY,
            double width,
            double height,
            double rotationDegrees
    ) {
        public InlineLabelEditCandidate {
            text = text == null ? "" : text;
            width = Math.max(1.0, width);
            height = Math.max(0.6, height);
        }
    }

    record InlineLabelEditPresentationKey(
            PreparedLabelKind labelKind,
            long ownerId,
            long clusterId,
            PreparedTopologyKind topologyKind,
            long topologyId
    ) {
        InlineLabelEditPresentationKey {
            labelKind = labelKind == null ? PreparedLabelKind.EMPTY : labelKind;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyKind = topologyKind == null ? PreparedTopologyKind.EMPTY : topologyKind;
            topologyId = Math.max(0L, topologyId);
        }

        static InlineLabelEditPresentationKey empty() {
            return new InlineLabelEditPresentationKey(
                    PreparedLabelKind.EMPTY,
                    0L,
                    0L,
                    PreparedTopologyKind.EMPTY,
                    0L);
        }

        boolean labelTarget() {
            return labelKind != PreparedLabelKind.EMPTY;
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
            return new Viewport(0.0, 0.0, DungeonMapViewportScale.defaultZoom());
        }

        public Viewport {
            zoom = Math.max(
                    DungeonMapViewportScale.minimumZoom(),
                    Math.min(DungeonMapViewportScale.maximumZoom(), zoom));
        }

        public double gridSize() {
            return DungeonMapViewportScale.baseGrid() * zoom;
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
            List<MapCanvasPolygonPrimitive> interactionSurfaces,
            List<BoundaryPrimitive> interactionBoundaries,
            List<GlyphPrimitive> interactionGlyphs,
            List<TextPrimitive> interactionTexts,
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
            interactionSurfaces = copyOf(interactionSurfaces);
            interactionBoundaries = copyOf(interactionBoundaries);
            interactionGlyphs = copyOf(interactionGlyphs);
            interactionTexts = copyOf(interactionTexts);
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
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of());
        }

        RenderScene withHoverOverlay(DungeonMapSceneAssembler.SceneBuckets hoverOverlay) {
            DungeonMapSceneAssembler.SceneBuckets safeOverlay = hoverOverlay == null
                    ? DungeonMapSceneAssembler.SceneBuckets.empty()
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
                    interactionSurfaces,
                    interactionBoundaries,
                    interactionGlyphs,
                    interactionTexts,
                    actors,
                    safeOverlay.surfaces(),
                    safeOverlay.boundaries(),
                    safeOverlay.glyphs(),
                    safeOverlay.texts());
        }

        RenderScene withStatusLabel(String nextStatusLabel) {
            return new RenderScene(
                    title,
                    subtitle,
                    modeLabel,
                    nextStatusLabel,
                    summaryLabel,
                    sceneLoaded,
                    overlayMessage,
                    gridView,
                    surfaces,
                    boundaries,
                    glyphs,
                    texts,
                    relations,
                    interactionSurfaces,
                    interactionBoundaries,
                    interactionGlyphs,
                    interactionTexts,
                    actors,
                    hoverSurfaces,
                    hoverBoundaries,
                    hoverGlyphs,
                    hoverTexts);
        }

        public boolean gridView() {
            return gridView;
        }

        public boolean containsRenderablePrimitives() {
            return containsSurfacePrimitives()
                    || containsAnnotationPrimitives();
        }

        private boolean containsSurfacePrimitives() {
            return !surfaces.isEmpty()
                    || !boundaries.isEmpty()
                    || !glyphs.isEmpty()
                    || !interactionSurfaces.isEmpty()
                    || !interactionBoundaries.isEmpty()
                    || !interactionGlyphs.isEmpty()
                    || !actors.isEmpty();
        }

        private boolean containsAnnotationPrimitives() {
            return !texts.isEmpty() || !interactionTexts.isEmpty() || !relations.isEmpty();
        }

        boolean sameBasePaint(RenderScene other) {
            return other != null
                    && gridView == other.gridView
                    && Objects.equals(surfaces, other.surfaces)
                    && Objects.equals(boundaries, other.boundaries)
                    && Objects.equals(glyphs, other.glyphs)
                    && Objects.equals(texts, other.texts)
                    && Objects.equals(relations, other.relations);
        }

        boolean sameInteractionPaint(RenderScene other) {
            return other != null
                    && Objects.equals(interactionSurfaces, other.interactionSurfaces)
                    && Objects.equals(interactionBoundaries, other.interactionBoundaries)
                    && Objects.equals(interactionGlyphs, other.interactionGlyphs)
                    && Objects.equals(interactionTexts, other.interactionTexts);
        }

        boolean sameActorPaint(RenderScene other) {
            return other != null && Objects.equals(actors, other.actors);
        }

        @Override
        public List<MapCanvasPolygonPrimitive> surfaces() {
            List<MapCanvasPolygonPrimitive> combined = new java.util.ArrayList<>(
                    surfaces.size() + interactionSurfaces.size() + hoverSurfaces.size());
            combined.addAll(interactionSurfaces);
            combined.addAll(surfaces);
            combined.addAll(hoverSurfaces);
            return List.copyOf(combined);
        }

        @Override
        public List<BoundaryPrimitive> boundaries() {
            List<BoundaryPrimitive> combined = new java.util.ArrayList<>(
                    boundaries.size() + interactionBoundaries.size() + hoverBoundaries.size());
            combined.addAll(interactionBoundaries);
            combined.addAll(boundaries);
            combined.addAll(hoverBoundaries);
            return List.copyOf(combined);
        }

        @Override
        public List<GlyphPrimitive> glyphs() {
            List<GlyphPrimitive> combined = new java.util.ArrayList<>(
                    glyphs.size() + interactionGlyphs.size() + hoverGlyphs.size());
            combined.addAll(interactionGlyphs);
            combined.addAll(glyphs);
            combined.addAll(hoverGlyphs);
            return List.copyOf(combined);
        }

        @Override
        public List<TextPrimitive> texts() {
            List<TextPrimitive> combined = new java.util.ArrayList<>(
                    texts.size() + interactionTexts.size() + hoverTexts.size());
            combined.addAll(interactionTexts);
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
        public List<MapCanvasPolygonPrimitive> interactionSurfaces() {
            return copyOf(interactionSurfaces);
        }

        @Override
        public List<BoundaryPrimitive> interactionBoundaries() {
            return copyOf(interactionBoundaries);
        }

        @Override
        public List<GlyphPrimitive> interactionGlyphs() {
            return copyOf(interactionGlyphs);
        }

        @Override
        public List<TextPrimitive> interactionTexts() {
            return copyOf(interactionTexts);
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
            PreparedBoundaryKind boundaryKind,
            String key,
            long ownerId,
            PreparedTopologyKind topologyKind,
            long topologyId,
            double startQ,
            double startR,
            int startLevel,
            double endQ,
            double endR,
            int endLevel
    ) {
        public BoundaryTarget {
            boundaryKind = safeBoundaryKind(boundaryKind);
            key = safeBoundaryKey(key);
            ownerId = safeBoundaryId(ownerId);
            topologyKind = safeBoundaryTopologyKind(topologyKind);
            topologyId = safeBoundaryId(topologyId);
            startQ = safeBoundaryCoordinate(startQ);
            startR = safeBoundaryCoordinate(startR);
            endQ = safeBoundaryCoordinate(endQ);
            endR = safeBoundaryCoordinate(endR);
        }

        public static BoundaryTarget empty() {
            return new BoundaryTarget(
                    PreparedBoundaryKind.WALL,
                    "",
                    0L,
                    PreparedTopologyKind.EMPTY,
                    0L,
                    0.0,
                    0.0,
                    0,
                    0.0,
                    0.0,
                    0);
        }

        private static PreparedBoundaryKind safeBoundaryKind(PreparedBoundaryKind value) {
            return value == null ? PreparedBoundaryKind.WALL : value;
        }

        private static String safeBoundaryKey(String value) {
            return value == null ? "" : value.strip();
        }

        private static long safeBoundaryId(long value) {
            return Math.max(0L, value);
        }

        private static PreparedTopologyKind safeBoundaryTopologyKind(PreparedTopologyKind value) {
            return value == null ? PreparedTopologyKind.EMPTY : value;
        }

        private static double safeBoundaryCoordinate(double value) {
            return Double.isFinite(value) ? value : 0.0;
        }
    }

    public record PointerTarget(
            PreparedTargetKind targetKind,
            PreparedLabelKind labelKind,
            PreparedElementKind elementKind,
            long ownerId,
            long clusterId,
            PreparedTopologyKind topologyKind,
            long topologyId,
            DungeonEditorHandleRef handleRef,
            BoundaryTarget boundaryRef,
            PreparedSyntheticHoverKind syntheticHoverKind,
            CellTarget cellRef,
            VertexTarget vertexRef
    ) {
        public PointerTarget {
            targetKind = targetKind == null ? PreparedTargetKind.EMPTY : targetKind;
            labelKind = labelKind == null ? PreparedLabelKind.EMPTY : labelKind;
            elementKind = elementKind == null ? PreparedElementKind.EMPTY : elementKind;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyKind = topologyKind == null ? PreparedTopologyKind.EMPTY : topologyKind;
            topologyId = Math.max(0L, topologyId);
            handleRef = handleRef == null ? DungeonEditorHandleRef.empty() : handleRef;
            boundaryRef = boundaryRef == null ? BoundaryTarget.empty() : boundaryRef;
            syntheticHoverKind = syntheticHoverKind == null ? PreparedSyntheticHoverKind.NONE : syntheticHoverKind;
            cellRef = cellRef == null ? CellTarget.empty() : cellRef;
            vertexRef = vertexRef == null ? VertexTarget.empty() : vertexRef;
        }

        public static PointerTarget empty() {
            return new PointerTarget(
                    PreparedTargetKind.EMPTY,
                    PreparedLabelKind.EMPTY,
                    PreparedElementKind.EMPTY,
                    0L,
                    0L,
                    PreparedTopologyKind.EMPTY,
                    0L,
                    DungeonEditorHandleRef.empty(),
                    BoundaryTarget.empty(),
                    PreparedSyntheticHoverKind.NONE,
                    CellTarget.empty(),
                    VertexTarget.empty());
        }

        static PointerTarget partyToken() {
            return new PointerTarget(
                    PreparedTargetKind.PARTY_TOKEN,
                    PreparedLabelKind.EMPTY,
                    PreparedElementKind.EMPTY,
                    0L,
                    0L,
                    PreparedTopologyKind.EMPTY,
                    0L,
                    DungeonEditorHandleRef.empty(),
                    BoundaryTarget.empty(),
                    PreparedSyntheticHoverKind.NONE,
                    CellTarget.empty(),
                    VertexTarget.empty());
        }

        public static PointerTarget target(
                PreparedTargetKind targetKind,
                PreparedLabelKind labelKind,
                PreparedElementKind elementKind,
                long ownerId,
                long clusterId,
                PreparedTopologyKind topologyKind,
                long topologyId,
                DungeonEditorHandleRef handleRef,
                BoundaryTarget boundaryRef,
                PreparedSyntheticHoverKind syntheticHoverKind
        ) {
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
                    CellTarget.empty(),
                    VertexTarget.empty());
        }

        public static PointerTarget label(
                PreparedLabelKind labelKind,
                long ownerId,
                long clusterId,
                DungeonMapRenderState.TopologyRef topologyRef
        ) {
            DungeonMapRenderState.TopologyRef safeTopologyRef = topologyRef == null
                    ? DungeonMapRenderState.TopologyRef.empty()
                    : topologyRef;
            return new PointerTarget(
                    PreparedTargetKind.LABEL,
                    labelKind,
                    preparedElementKind(safeTopologyRef.kind()),
                    ownerId,
                    clusterId,
                    safeTopologyRef.kind(),
                    safeTopologyRef.id(),
                    DungeonEditorHandleRef.empty(),
                    BoundaryTarget.empty(),
                    PreparedSyntheticHoverKind.NONE,
                    CellTarget.empty(),
                    VertexTarget.empty());
        }

        public static PointerTarget syntheticCell(PreparedElementKind elementKind, int q, int r, int level) {
            return new PointerTarget(
                    PreparedTargetKind.CELL,
                    PreparedLabelKind.EMPTY,
                    elementKind,
                    0L,
                    0L,
                    PreparedTopologyKind.EMPTY,
                    0L,
                    DungeonEditorHandleRef.empty(),
                    BoundaryTarget.empty(),
                    PreparedSyntheticHoverKind.CELL,
                    new CellTarget("hover-cell:" + elementKind.name() + ":" + q + ":" + r + ":" + level, q, r, level),
                    VertexTarget.empty());
        }

        public static PointerTarget syntheticVertex(int q, int r, int level) {
            return new PointerTarget(
                    PreparedTargetKind.VERTEX,
                    PreparedLabelKind.EMPTY,
                    PreparedElementKind.WALL_VERTEX,
                    0L,
                    0L,
                    PreparedTopologyKind.EMPTY,
                    0L,
                    DungeonEditorHandleRef.empty(),
                    BoundaryTarget.empty(),
                    PreparedSyntheticHoverKind.VERTEX,
                    CellTarget.empty(),
                    new VertexTarget(true, q, r, level));
        }

        public static PointerTarget syntheticBoundary(
                int startQ,
                int startR,
                int endQ,
                int endR,
                int level
        ) {
            BoundaryTarget boundary = new BoundaryTarget(
                    PreparedBoundaryKind.WALL,
                    "hover-boundary:WALL:" + startQ + ":" + startR + ":" + level
                            + ":" + endQ + ":" + endR + ":" + level,
                    0L,
                    PreparedTopologyKind.EMPTY,
                    0L,
                    startQ,
                    startR,
                    level,
                    endQ,
                    endR,
                    level);
            return new PointerTarget(
                    PreparedTargetKind.BOUNDARY,
                    PreparedLabelKind.EMPTY,
                    PreparedElementKind.WALL,
                    0L,
                    0L,
                    PreparedTopologyKind.EMPTY,
                    0L,
                    DungeonEditorHandleRef.empty(),
                    boundary,
                    PreparedSyntheticHoverKind.BOUNDARY,
                    CellTarget.empty(),
                    VertexTarget.empty());
        }

        PointerTarget withCellRef(CellTarget nextCellRef) {
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
            return syntheticHoverKind != PreparedSyntheticHoverKind.NONE;
        }

        public boolean isEmptyTarget() {
            return targetKind == PreparedTargetKind.EMPTY;
        }

        public boolean isBoundaryTarget() {
            return targetKind == PreparedTargetKind.BOUNDARY;
        }

        public boolean isVertexTarget() {
            return targetKind == PreparedTargetKind.VERTEX;
        }

        public boolean isCellTarget() {
            return targetKind == PreparedTargetKind.CELL;
        }

        public boolean isPartyTokenTarget() {
            return targetKind == PreparedTargetKind.PARTY_TOKEN;
        }

        public boolean isHandleTarget() {
            return targetKind == PreparedTargetKind.HANDLE;
        }

        public boolean isGraphNodeTarget() {
            return targetKind == PreparedTargetKind.GRAPH_NODE
                    && topologyId > 0L
                    && topologyKind != PreparedTopologyKind.EMPTY;
        }

        public boolean isLabelTarget() {
            return targetKind == PreparedTargetKind.LABEL;
        }

        public boolean isMarkerTarget() {
            return targetKind == PreparedTargetKind.MARKER;
        }

        public boolean isRoomLabelTarget() {
            return isLabelTarget() && labelKind == PreparedLabelKind.ROOM_LABEL;
        }

        public boolean isClusterLabelTarget() {
            return isLabelTarget() && labelKind == PreparedLabelKind.CLUSTER_LABEL;
        }

        public boolean hasTransitionElement() {
            return elementKind == PreparedElementKind.TRANSITION;
        }

        public boolean hasRoomElement() {
            return elementKind == PreparedElementKind.ROOM;
        }

        public boolean hasFeatureMarkerElement() {
            return elementKind == PreparedElementKind.FEATURE_MARKER;
        }

        public boolean isWallOrDoorBoundaryTarget() {
            return isBoundaryTarget()
                    && (boundaryRef.boundaryKind() == PreparedBoundaryKind.WALL
                    || boundaryRef.boundaryKind() == PreparedBoundaryKind.DOOR);
        }

        public boolean isCorridorCellTarget() {
            return isCellTarget() && elementKind == PreparedElementKind.CORRIDOR;
        }

        public boolean selectableBySelectTool() {
            return !syntheticHoverTarget()
                    && !isRoomLabelTarget()
                    && (isHandleTarget()
                    || isLabelTarget()
                    || isMarkerTarget()
                    || isGraphNodeTarget()
                    || isCellTarget()
                    || isBoundaryTarget());
        }

        public double boundaryDistanceTo(double sceneX, double sceneY) {
            if (!isBoundaryTarget()) {
                return Double.POSITIVE_INFINITY;
            }
            double dx = boundaryRef.endQ() - boundaryRef.startQ();
            double dy = boundaryRef.endR() - boundaryRef.startR();
            double lengthSquared = dx * dx + dy * dy;
            if (lengthSquared <= 0.0) {
                return Math.hypot(sceneX - boundaryRef.startQ(), sceneY - boundaryRef.startR());
            }
            double position = ((sceneX - boundaryRef.startQ()) * dx
                    + (sceneY - boundaryRef.startR()) * dy) / lengthSquared;
            double clamped = Math.max(0.0, Math.min(1.0, position));
            return Math.hypot(
                    sceneX - (boundaryRef.startQ() + clamped * dx),
                    sceneY - (boundaryRef.startR() + clamped * dy));
        }

        public String boundaryTieBreakKey() {
            return boundaryRef.boundaryKind().name()
                    + ":" + boundaryRef.ownerId()
                    + ":" + boundaryRef.topologyKind().name()
                    + ":" + boundaryRef.topologyId()
                    + ":" + boundaryRef.key();
        }

        public String labelKindKey() {
            return labelKind.name();
        }

        public DungeonEditorPointerInput.Target toApiTarget() {
            return new DungeonEditorPointerInput.Target(
                    apiTargetKind(targetKind),
                    apiLabelKind(labelKind),
                    apiElementKind(elementKind),
                    ownerId,
                    clusterId,
                    apiTopologyKind(topologyKind),
                    topologyId,
                    handleRef,
                    new DungeonEditorPointerInput.BoundaryTarget(
                            apiBoundaryKind(boundaryRef.boundaryKind()),
                            boundaryRef.key(),
                            boundaryRef.ownerId(),
                            apiTopologyKind(boundaryRef.topologyKind()),
                            boundaryRef.topologyId(),
                            boundaryRef.startQ(),
                            boundaryRef.startR(),
                            boundaryRef.startLevel(),
                            boundaryRef.endQ(),
                            boundaryRef.endR(),
                            boundaryRef.endLevel()),
                    apiSyntheticHoverKind(syntheticHoverKind),
                    new DungeonEditorPointerInput.CellTarget(
                            cellRef.exact(), cellRef.q(), cellRef.r(), cellRef.level()),
                    new DungeonEditorPointerInput.VertexTarget(
                            vertexRef.exact(), vertexRef.q(), vertexRef.r(), vertexRef.level()));
        }

        private static DungeonEditorPointerInput.TargetKind apiTargetKind(PreparedTargetKind kind) {
            return switch (kind) {
                case EMPTY, PARTY_TOKEN -> DungeonEditorPointerInput.TargetKind.EMPTY;
                case CELL -> DungeonEditorPointerInput.TargetKind.CELL;
                case LABEL -> DungeonEditorPointerInput.TargetKind.LABEL;
                case MARKER -> DungeonEditorPointerInput.TargetKind.MARKER;
                case GRAPH_NODE -> DungeonEditorPointerInput.TargetKind.GRAPH_NODE;
                case HANDLE -> DungeonEditorPointerInput.TargetKind.HANDLE;
                case BOUNDARY -> DungeonEditorPointerInput.TargetKind.BOUNDARY;
                case VERTEX -> DungeonEditorPointerInput.TargetKind.VERTEX;
            };
        }

        private static DungeonEditorPointerInput.LabelKind apiLabelKind(PreparedLabelKind kind) {
            return switch (kind) {
                case EMPTY -> DungeonEditorPointerInput.LabelKind.EMPTY;
                case ROOM_LABEL -> DungeonEditorPointerInput.LabelKind.ROOM_LABEL;
                case CLUSTER_LABEL -> DungeonEditorPointerInput.LabelKind.CLUSTER_LABEL;
                case FEATURE_LABEL -> DungeonEditorPointerInput.LabelKind.FEATURE_LABEL;
            };
        }

        private static DungeonEditorPointerInput.ElementKind apiElementKind(PreparedElementKind kind) {
            return switch (kind) {
                case EMPTY -> DungeonEditorPointerInput.ElementKind.EMPTY;
                case ROOM -> DungeonEditorPointerInput.ElementKind.ROOM;
                case CORRIDOR -> DungeonEditorPointerInput.ElementKind.CORRIDOR;
                case CORRIDOR_ANCHOR -> DungeonEditorPointerInput.ElementKind.CORRIDOR_ANCHOR;
                case STAIR -> DungeonEditorPointerInput.ElementKind.STAIR;
                case TRANSITION -> DungeonEditorPointerInput.ElementKind.TRANSITION;
                case FEATURE_MARKER -> DungeonEditorPointerInput.ElementKind.FEATURE_MARKER;
                case FEATURE_OBJECT -> DungeonEditorPointerInput.ElementKind.FEATURE_OBJECT;
                case FEATURE_ENCOUNTER -> DungeonEditorPointerInput.ElementKind.FEATURE_ENCOUNTER;
                case FEATURE_POI -> DungeonEditorPointerInput.ElementKind.FEATURE_POI;
                case WALL -> DungeonEditorPointerInput.ElementKind.WALL;
                case DOOR -> DungeonEditorPointerInput.ElementKind.DOOR;
                case WALL_VERTEX -> DungeonEditorPointerInput.ElementKind.WALL_VERTEX;
            };
        }

        private static DungeonEditorPointerInput.TopologyKind apiTopologyKind(PreparedTopologyKind kind) {
            return switch (kind) {
                case EMPTY -> DungeonEditorPointerInput.TopologyKind.EMPTY;
                case ROOM -> DungeonEditorPointerInput.TopologyKind.ROOM;
                case CORRIDOR -> DungeonEditorPointerInput.TopologyKind.CORRIDOR;
                case CORRIDOR_ANCHOR -> DungeonEditorPointerInput.TopologyKind.CORRIDOR_ANCHOR;
                case DOOR -> DungeonEditorPointerInput.TopologyKind.DOOR;
                case WALL -> DungeonEditorPointerInput.TopologyKind.WALL;
                case STAIR -> DungeonEditorPointerInput.TopologyKind.STAIR;
                case TRANSITION -> DungeonEditorPointerInput.TopologyKind.TRANSITION;
                case FEATURE_MARKER -> DungeonEditorPointerInput.TopologyKind.FEATURE_MARKER;
            };
        }

        private static DungeonEditorPointerInput.BoundaryKind apiBoundaryKind(PreparedBoundaryKind kind) {
            return switch (kind) {
                case WALL -> DungeonEditorPointerInput.BoundaryKind.WALL;
                case DOOR -> DungeonEditorPointerInput.BoundaryKind.DOOR;
            };
        }

        private static DungeonEditorPointerInput.SyntheticHoverKind apiSyntheticHoverKind(
                PreparedSyntheticHoverKind kind
        ) {
            return switch (kind) {
                case NONE -> DungeonEditorPointerInput.SyntheticHoverKind.NONE;
                case CELL -> DungeonEditorPointerInput.SyntheticHoverKind.CELL;
                case BOUNDARY -> DungeonEditorPointerInput.SyntheticHoverKind.BOUNDARY;
                case VERTEX -> DungeonEditorPointerInput.SyntheticHoverKind.VERTEX;
            };
        }

        public DungeonMapRenderState.TopologyRef topologyRef() {
            return new DungeonMapRenderState.TopologyRef(topologyKind, topologyId);
        }
    }

}
