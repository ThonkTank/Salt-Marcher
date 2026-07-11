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
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.domain.dungeon.published.TravelDungeonSnapshot;
import src.features.dungeon.runtime.DungeonEditorInlineLabelEditSession;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.MapSurfaceFrame;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreparedBoundaryKind;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreparedBoundaryTargetFrame;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreparedElementKind;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreparedLabelKind;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreparedPointerTargetFrame;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreparedSyntheticHoverKind;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreparedTargetKind;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreparedTopologyKind;
import src.features.dungeon.runtime.DungeonEditorRenderFrame;
import src.features.dungeon.runtime.DungeonEditorRuntimePointerTarget;

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
    private Map<String, PreparedPointerTargetFrame> currentPointerTargetFrames = Map.of();

    // Public ContentModel API

    public DungeonMapContentModel(String placeholderTitle, boolean editorMode) {
        this.placeholderTitle = normalizePlaceholderTitle(placeholderTitle);
        canvasState = new ReadOnlyObjectWrapper<>(CanvasState.initial(
                RenderScene.empty(this.placeholderTitle),
                viewportContentPartModel.currentViewport()));
        renderState = DungeonMapRenderState.empty(this.placeholderTitle, editorMode);
        showRenderScene(rebuildRenderSceneProjection(PointerTarget.empty()), true);
    }

    public ReadOnlyObjectProperty<CanvasState> canvasStateProperty() {
        return canvasState.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<InlineLabelEditState> inlineLabelEditStateProperty() {
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

    public List<String> pointerHitRefsAt(double sceneX, double sceneY) {
        return hitsAt(sceneX, sceneY).stream()
                .map(DungeonMapHitGeometryContentPartModel.CanvasHit::hitRef)
                .toList();
    }

    public Map<String, PreparedPointerTargetFrame> currentPointerTargetFrames() {
        return Map.copyOf(currentPointerTargetFrames);
    }

    public void updateHoverTarget(PointerTarget target) {
        if (!frameConsumptionContentPartModel.updateHoverTarget(target)) {
            return;
        }
        PointerTarget hoverTarget = frameConsumptionContentPartModel.currentHoverTarget();
        showHoverOverlay(hoverTarget);
    }

    public void updateRuntimeHoverDisplayTarget(DungeonEditorRuntimePointerTarget target) {
        updateHoverTarget(runtimeHoverDisplayTarget(target));
    }

    public void clearHoverTarget() {
        if (!frameConsumptionContentPartModel.clearHoverTarget()) {
            return;
        }
        publishHoverOverlay(DungeonMapRenderSceneContentPartModel.SceneBuckets.empty());
    }

    public Optional<InlineLabelEditCandidate> inlineLabelEditCandidate(DungeonEditorRuntimePointerTarget target) {
        return inlineLabelUiStateContentPartModel.inlineLabelEditCandidate(
                inlineLabelEditPresentationKey(target),
                renderState.labels());
    }

    public void applyEditorRenderFrame(DungeonEditorRenderFrame frame) {
        DungeonEditorRenderFrame safeFrame = frame == null ? DungeonEditorRenderFrame.empty() : frame;
        inlineLabelUiStateContentPartModel.applyInlineLabelEditProjection(
                inlineLabelProjection(safeFrame.inlineLabelEditSession()));
        DungeonEditorPreparedFrameFacts facts = safeFrame.preparedFacts();
        DungeonEditorPreparedFrameFacts.MapInteractionFrame interactionFrame = facts.mapInteractionFrame();
        currentPointerTargetFrames = preparedPointerTargets(interactionFrame.pointerTargets());
        applyEditorSurfaceFrame(
                facts.mapSurfaceFrame(),
                mapInteractionFrame(interactionFrame));
    }

    private void applyEditorSurfaceFrame(
            MapSurfaceFrame editorSurfaceFrame,
            MapInteractionFrame interactionFrame
    ) {
        DungeonMapFrameConsumptionContentPartModel.EditorSurfaceFrame frame =
                frameConsumptionContentPartModel.consumeEditorSurfaceFrame(editorSurfaceFrame, interactionFrame);
        if (!frame.changed()) {
            updateRenderStateMetadata(frame.editorSurfaceFrame());
            return;
        }
        showRenderState(snapshotProjectionContentPartModel.mapEditorSurface(
                placeholderTitle,
                frame.editorSurfaceFrame(),
                frame.interactionFrame(),
                roomLabelPlacementContentPartModel,
                previewDiffContentPartModel), frame.interactionFrame());
    }

    private static InlineLabelEditProjection inlineLabelProjection(
            DungeonEditorInlineLabelEditSession session
    ) {
        DungeonEditorInlineLabelEditSession safeSession = session == null
                ? DungeonEditorInlineLabelEditSession.inactive()
                : session;
        if (!safeSession.active()) {
            return InlineLabelEditProjection.inactive();
        }
        return new InlineLabelEditProjection(
                true,
                safeSession.labelKind(),
                safeSession.ownerId(),
                safeSession.clusterId(),
                safeSession.topologyKind(),
                safeSession.topologyId(),
                safeSession.draftText(),
                safeSession.centerX(),
                safeSession.centerY(),
                safeSession.width(),
                safeSession.height(),
                safeSession.rotationDegrees());
    }

    public void applyTravelSnapshot(TravelDungeonSnapshot travelSnapshot) {
        showRenderState(snapshotProjectionContentPartModel.mapTravel(
                placeholderTitle,
                travelSnapshot,
                roomLabelPlacementContentPartModel), frameConsumptionContentPartModel.consumeTravelSnapshot());
    }

    private void updateRenderStateMetadata(MapSurfaceFrame editorSurfaceFrame) {
        renderState = renderState.withSelectedTool(selectedToolLabel(editorSurfaceFrame));
        setCanvasState(canvasState.get().withRenderSceneMetadata(
                canvasState.get().baseRenderScene().withStatusLabel(renderState.statusLabel()),
                viewportContentPartModel.currentViewport()));
    }

    private static String selectedToolLabel(MapSurfaceFrame editorSurfaceFrame) {
        MapSurfaceFrame safeFrame = editorSurfaceFrame == null
                ? MapSurfaceFrame.empty()
                : editorSurfaceFrame;
        return DungeonEditorTool.labelFor(safeFrame.selectedTool());
    }

    private static MapInteractionFrame mapInteractionFrame(DungeonEditorPreparedFrameFacts.MapInteractionFrame frame) {
        DungeonEditorPreparedFrameFacts.MapInteractionFrame safeFrame = frame == null
                ? DungeonEditorPreparedFrameFacts.MapInteractionFrame.empty()
                : frame;
        return new MapInteractionFrame(
                renderPointerTargets(safeFrame.pointerTargets()),
                safeFrame.previewHandleHitRefs());
    }

    private static Map<String, PreparedPointerTargetFrame> preparedPointerTargets(
            Map<String, PreparedPointerTargetFrame> targets
    ) {
        return targets == null || targets.isEmpty() ? Map.of() : Map.copyOf(targets);
    }

    private static Map<String, PointerTarget> renderPointerTargets(
            Map<String, PreparedPointerTargetFrame> targets
    ) {
        if (targets == null || targets.isEmpty()) {
            return Map.of();
        }
        Map<String, PointerTarget> neutralTargets = new java.util.LinkedHashMap<>();
        for (Map.Entry<String, PreparedPointerTargetFrame> entry : targets.entrySet()) {
            neutralTargets.put(entry.getKey(), renderPointerTarget(entry.getValue()));
        }
        return Map.copyOf(neutralTargets);
    }

    private static PointerTarget renderPointerTarget(PreparedPointerTargetFrame target) {
        PreparedPointerTargetFrame safeTarget = target == null
                ? DungeonEditorPreparedFrameFacts.PreparedPointerTargetFrame.empty()
                : target;
        if (safeTarget.cell().exact()) {
            return PointerTarget.syntheticCell(
                    safeTarget.elementKind(),
                    safeTarget.cell().q(),
                    safeTarget.cell().r(),
                    safeTarget.cell().level());
        }
        if (safeTarget.vertex().exact()) {
            return PointerTarget.syntheticVertex(
                    safeTarget.vertex().q(),
                    safeTarget.vertex().r(),
                    safeTarget.vertex().level());
        }
        return PointerTarget.target(
                safeTarget.targetKind(),
                safeTarget.labelKind(),
                safeTarget.elementKind(),
                safeTarget.ownerId(),
                safeTarget.clusterId(),
                safeTarget.topologyKind(),
                safeTarget.topologyId(),
                safeTarget.handleRef(),
                renderBoundaryTarget(safeTarget.boundary()),
                safeTarget.syntheticHoverKind());
    }

    private static BoundaryTarget renderBoundaryTarget(PreparedBoundaryTargetFrame boundary) {
        PreparedBoundaryTargetFrame safeBoundary = boundary == null
                ? DungeonEditorPreparedFrameFacts.PreparedBoundaryTargetFrame.empty()
                : boundary;
        return new BoundaryTarget(
                safeBoundary.boundaryKind(),
                safeBoundary.key(),
                safeBoundary.ownerId(),
                safeBoundary.topologyKind(),
                safeBoundary.topologyId(),
                safeBoundary.startQ(),
                safeBoundary.startR(),
                safeBoundary.startLevel(),
                safeBoundary.endQ(),
                safeBoundary.endR(),
                safeBoundary.endLevel());
    }

    private static PointerTarget runtimeHoverDisplayTarget(DungeonEditorRuntimePointerTarget target) {
        DungeonEditorRuntimePointerTarget safeTarget = target == null
                ? DungeonEditorRuntimePointerTarget.empty()
                : target;
        if (safeTarget.isSyntheticCellHover() && safeTarget.cell().exact()) {
            return PointerTarget.syntheticCell(
                    preparedElementKind(safeTarget.elementKind()),
                    safeTarget.cellQ(),
                    safeTarget.cellR(),
                    safeTarget.cellLevel());
        }
        if (safeTarget.isVertexTarget() && safeTarget.vertex().exact()) {
            return PointerTarget.syntheticVertex(
                    safeTarget.vertexQ(),
                    safeTarget.vertexR(),
                    safeTarget.vertexLevel());
        }
        return PointerTarget.target(
                preparedTargetKind(safeTarget.targetKind()),
                preparedLabelKind(safeTarget.labelKind()),
                preparedElementKind(safeTarget.elementKind()),
                safeTarget.ownerId(),
                safeTarget.clusterId(),
                preparedTopologyKind(safeTarget.topologyKind()),
                safeTarget.topologyId(),
                safeTarget.handleRef(),
                runtimeHoverDisplayBoundaryTarget(safeTarget.boundary()),
                preparedSyntheticHoverKind(safeTarget.syntheticHoverKind()));
    }

    private static InlineLabelEditPresentationKey inlineLabelEditPresentationKey(
            DungeonEditorRuntimePointerTarget target
    ) {
        DungeonEditorRuntimePointerTarget safeTarget = target == null
                ? DungeonEditorRuntimePointerTarget.empty()
                : target;
        if (!safeTarget.isLabelTarget()) {
            return InlineLabelEditPresentationKey.empty();
        }
        return new InlineLabelEditPresentationKey(
                preparedLabelKind(safeTarget.labelKind()),
                safeTarget.ownerId(),
                safeTarget.clusterId(),
                preparedTopologyKind(safeTarget.topologyKind()),
                safeTarget.topologyId());
    }

    private static BoundaryTarget runtimeHoverDisplayBoundaryTarget(
            DungeonEditorRuntimePointerTarget.BoundaryTarget boundary
    ) {
        DungeonEditorRuntimePointerTarget.BoundaryTarget safeBoundary = boundary == null
                ? DungeonEditorRuntimePointerTarget.BoundaryTarget.empty()
                : boundary;
        return new BoundaryTarget(
                preparedBoundaryKind(safeBoundary.boundaryKind()),
                safeBoundary.key(),
                safeBoundary.ownerId(),
                preparedTopologyKind(safeBoundary.topologyKind()),
                safeBoundary.topologyId(),
                safeBoundary.startQ(),
                safeBoundary.startR(),
                safeBoundary.startLevel(),
                safeBoundary.endQ(),
                safeBoundary.endR(),
                safeBoundary.endLevel());
    }

    void recordCanvasRedraw(long elapsedNanos) {
        // Retained as the canvas redraw hook; Wave 08 removed the unused local accumulator.
    }

    private void showRenderState(DungeonMapRenderState nextRenderState, MapInteractionFrame interactionFrame) {
        renderState = nextRenderState == null ? renderState : nextRenderState;
        PointerTarget retainedHoverTarget = frameConsumptionContentPartModel.consumeRenderFrame(interactionFrame);
        showRenderScene(rebuildRenderSceneProjection(PointerTarget.empty()), true);
        if (!retainedHoverTarget.isEmptyTarget()) {
            showHoverOverlay(retainedHoverTarget);
        }
    }

    private DungeonMapRenderSceneContentPartModel.RenderSceneProjection rebuildRenderSceneProjection(
            PointerTarget hoverTarget
    ) {
        return renderSceneContentPartModel.toSceneProjection(renderState, hoverTarget);
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
        publishHoverOverlay(hoverOverlay);
    }

    private void publishHoverOverlay(DungeonMapRenderSceneContentPartModel.SceneBuckets hoverOverlay) {
        setCanvasState(canvasState.get().withHoverOverlay(
                hoverOverlay,
                viewportContentPartModel.currentViewport()));
    }

    private List<DungeonMapHitGeometryContentPartModel.CanvasHit> hitsAt(double sceneX, double sceneY) {
        return hitGeometryContentPartModel.hitsAt(sceneX, sceneY, currentViewport().gridSize());
    }

    static PreparedLabelKind preparedRenderLabelKind(String labelKind) {
        return switch (normalizeKind(labelKind, EMPTY_LABEL_KIND)) {
            case ROOM_LABEL_KIND -> PreparedLabelKind.ROOM_LABEL;
            case CLUSTER_LABEL_KIND -> PreparedLabelKind.CLUSTER_LABEL;
            case FEATURE_LABEL_KIND -> PreparedLabelKind.FEATURE_LABEL;
            default -> PreparedLabelKind.EMPTY;
        };
    }

    static PreparedTopologyKind preparedRenderTopologyKind(String topologyKind) {
        return switch (normalizeKind(topologyKind, EMPTY_KIND)) {
            case "ROOM" -> PreparedTopologyKind.ROOM;
            case "CORRIDOR" -> PreparedTopologyKind.CORRIDOR;
            case "CORRIDOR_ANCHOR" -> PreparedTopologyKind.CORRIDOR_ANCHOR;
            case "DOOR" -> PreparedTopologyKind.DOOR;
            case "WALL" -> PreparedTopologyKind.WALL;
            case "STAIR" -> PreparedTopologyKind.STAIR;
            case "TRANSITION" -> PreparedTopologyKind.TRANSITION;
            case "FEATURE_MARKER" -> PreparedTopologyKind.FEATURE_MARKER;
            default -> PreparedTopologyKind.EMPTY;
        };
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

    static String renderStateTopologyKindText(PreparedTopologyKind topologyKind) {
        return topologyKind == null || topologyKind == PreparedTopologyKind.EMPTY ? "" : topologyKind.name();
    }

    private static PreparedTargetKind preparedTargetKind(DungeonEditorRuntimePointerTarget.TargetKind targetKind) {
        if (targetKind == null) {
            return PreparedTargetKind.EMPTY;
        }
        return switch (targetKind) {
            case CELL -> PreparedTargetKind.CELL;
            case LABEL -> PreparedTargetKind.LABEL;
            case MARKER -> PreparedTargetKind.MARKER;
            case GRAPH_NODE -> PreparedTargetKind.GRAPH_NODE;
            case HANDLE -> PreparedTargetKind.HANDLE;
            case BOUNDARY -> PreparedTargetKind.BOUNDARY;
            case VERTEX -> PreparedTargetKind.VERTEX;
            default -> PreparedTargetKind.EMPTY;
        };
    }

    private static PreparedLabelKind preparedLabelKind(DungeonEditorRuntimePointerTarget.LabelKind labelKind) {
        if (labelKind == null) {
            return PreparedLabelKind.EMPTY;
        }
        return switch (labelKind) {
            case ROOM_LABEL -> PreparedLabelKind.ROOM_LABEL;
            case CLUSTER_LABEL -> PreparedLabelKind.CLUSTER_LABEL;
            case FEATURE_LABEL -> PreparedLabelKind.FEATURE_LABEL;
            default -> PreparedLabelKind.EMPTY;
        };
    }

    @SuppressWarnings("PMD.CyclomaticComplexity")
    private static PreparedElementKind preparedElementKind(DungeonEditorRuntimePointerTarget.ElementKind elementKind) {
        if (elementKind == null) {
            return PreparedElementKind.EMPTY;
        }
        return switch (elementKind) {
            case ROOM -> PreparedElementKind.ROOM;
            case CORRIDOR -> PreparedElementKind.CORRIDOR;
            case CORRIDOR_ANCHOR -> PreparedElementKind.CORRIDOR_ANCHOR;
            case STAIR -> PreparedElementKind.STAIR;
            case TRANSITION -> PreparedElementKind.TRANSITION;
            case FEATURE_MARKER -> PreparedElementKind.FEATURE_MARKER;
            case FEATURE_OBJECT -> PreparedElementKind.FEATURE_OBJECT;
            case FEATURE_ENCOUNTER -> PreparedElementKind.FEATURE_ENCOUNTER;
            case FEATURE_POI -> PreparedElementKind.FEATURE_POI;
            case WALL -> PreparedElementKind.WALL;
            case DOOR -> PreparedElementKind.DOOR;
            case WALL_VERTEX -> PreparedElementKind.WALL_VERTEX;
            default -> PreparedElementKind.EMPTY;
        };
    }

    @SuppressWarnings("PMD.CyclomaticComplexity")
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

    @SuppressWarnings("PMD.CyclomaticComplexity")
    private static PreparedTopologyKind preparedTopologyKind(DungeonEditorRuntimePointerTarget.TopologyKind topologyKind) {
        if (topologyKind == null) {
            return PreparedTopologyKind.EMPTY;
        }
        return switch (topologyKind) {
            case ROOM -> PreparedTopologyKind.ROOM;
            case CORRIDOR -> PreparedTopologyKind.CORRIDOR;
            case CORRIDOR_ANCHOR -> PreparedTopologyKind.CORRIDOR_ANCHOR;
            case DOOR -> PreparedTopologyKind.DOOR;
            case WALL -> PreparedTopologyKind.WALL;
            case STAIR -> PreparedTopologyKind.STAIR;
            case TRANSITION -> PreparedTopologyKind.TRANSITION;
            case FEATURE_MARKER -> PreparedTopologyKind.FEATURE_MARKER;
            default -> PreparedTopologyKind.EMPTY;
        };
    }

    private static PreparedBoundaryKind preparedBoundaryKind(DungeonEditorRuntimePointerTarget.BoundaryKind boundaryKind) {
        return boundaryKind == DungeonEditorRuntimePointerTarget.BoundaryKind.DOOR
                ? PreparedBoundaryKind.DOOR
                : PreparedBoundaryKind.WALL;
    }

    private static PreparedSyntheticHoverKind preparedSyntheticHoverKind(
            DungeonEditorRuntimePointerTarget.SyntheticHoverKind syntheticHoverKind
    ) {
        if (syntheticHoverKind == null) {
            return PreparedSyntheticHoverKind.NONE;
        }
        return switch (syntheticHoverKind) {
            case CELL -> PreparedSyntheticHoverKind.CELL;
            case BOUNDARY -> PreparedSyntheticHoverKind.BOUNDARY;
            case VERTEX -> PreparedSyntheticHoverKind.VERTEX;
            default -> PreparedSyntheticHoverKind.NONE;
        };
    }

    static PointerTarget selectableHoverTarget(PointerTarget target) {
        return DungeonMapFrameConsumptionContentPartModel.selectableHoverTarget(target);
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

        private CanvasState withRenderSceneMetadata(RenderScene nextRenderScene, Viewport nextViewport) {
            return new CanvasState(nextRenderScene, hoverOverlay, nextViewport);
        }

        private CanvasState withViewport(Viewport nextViewport) {
            return new CanvasState(renderScene, hoverOverlay, nextViewport);
        }

        private boolean sameAs(CanvasState other) {
            return other != null
                    && Objects.equals(renderScene, other.renderScene)
                    && Objects.equals(hoverOverlay, other.hoverOverlay)
                    && Objects.equals(viewport, other.viewport);
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
                    || !actors.isEmpty();
        }

        private boolean containsAnnotationPrimitives() {
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

    record MapInteractionFrame(
            Map<String, PointerTarget> pointerTargets,
            List<String> previewHandleHitRefs
    ) {
        MapInteractionFrame {
            pointerTargets = pointerTargets == null ? Map.of() : Map.copyOf(pointerTargets);
            previewHandleHitRefs = previewHandleHitRefs == null
                    ? List.of()
                    : List.copyOf(previewHandleHitRefs);
        }

        static MapInteractionFrame empty() {
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

        @SuppressWarnings("PMD.ExcessiveParameterList")
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
                String labelKind,
                long ownerId,
                long clusterId,
                DungeonMapRenderState.TopologyRef topologyRef
        ) {
            DungeonMapRenderState.TopologyRef safeTopologyRef = topologyRef == null
                    ? DungeonMapRenderState.TopologyRef.empty()
                    : topologyRef;
            return new PointerTarget(
                    PreparedTargetKind.LABEL,
                    preparedRenderLabelKind(labelKind),
                    preparedElementKind(preparedRenderTopologyKind(safeTopologyRef.kind())),
                    ownerId,
                    clusterId,
                    preparedRenderTopologyKind(safeTopologyRef.kind()),
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

        public DungeonMapRenderState.TopologyRef topologyRef() {
            return new DungeonMapRenderState.TopologyRef(renderStateTopologyKindText(topologyKind), topologyId);
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
            boolean preview,
            @Nullable DungeonEdgeRef sourceEdge,
            String hoverLabel
    ) {
        Marker(
                String label,
                double q,
                double r,
                int z,
                DungeonMapRenderState.MarkerKind kind,
                boolean selected,
                DungeonMapRenderState.MarkerHandle handle,
                boolean preview
        ) {
            this(label, q, r, z, kind, selected, handle, preview, null, "");
        }

        Marker {
            label = label == null ? "" : label;
            hoverLabel = hoverLabel == null ? "" : hoverLabel.trim();
            kind = kind == null ? MarkerKind.DOOR : kind;
            handle = handle == null
                    ? new MarkerHandle(null, 0, 0, 0, null)
                    : handle;
        }

        boolean isDoorMarker() {
            return kind == MarkerKind.DOOR;
        }

        boolean isTransitionMarker() {
            return kind == MarkerKind.TRANSITION;
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
