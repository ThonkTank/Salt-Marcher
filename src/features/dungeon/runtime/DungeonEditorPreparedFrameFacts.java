package src.features.dungeon.runtime;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorSurface;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonOverlaySettings;

@SuppressWarnings("PMD.CouplingBetweenObjects")
public record DungeonEditorPreparedFrameFacts(
        List<MapEntry> mapEntries,
        String selectedMapKey,
        long selectedMapIdValue,
        List<Integer> reachableLevels,
        boolean busy,
        String statusText,
        String viewModeKey,
        String viewModeLabel,
        DungeonOverlaySettings overlaySettings,
        OverlayFrame overlay,
        int projectionLevel,
        String selectedToolKey,
        String selectedToolLabel,
        MapSurfaceFrame mapSurfaceFrame,
        MapInteractionFrame mapInteractionFrame,
        StatePanelFrame statePanelFrame
) {
    private static final String SELECT_TOOL_KEY = "SELECT";
    private static final String GRID_VIEW_MODE_KEY = "GRID";
    private static final String GRAPH_VIEW_MODE_KEY = "GRAPH";
    private static final long NO_SELECTED_MAP_ID = 0L;
    private static final long NO_TRANSITION_ID = 0L;
    private static final String TRANSITION_CREATE_TOOL = "TRANSITION_CREATE";

    public DungeonEditorPreparedFrameFacts {
        mapEntries = mapEntries == null ? List.of() : List.copyOf(mapEntries);
        selectedMapKey = selectedMapKey == null ? "" : selectedMapKey;
        selectedMapIdValue = Math.max(0L, selectedMapIdValue);
        reachableLevels = reachableLevels == null ? List.of(0) : List.copyOf(reachableLevels);
        statusText = statusText == null ? "" : statusText;
        String normalizedViewModeKey = normalizeViewModeKey(viewModeKey);
        viewModeKey = normalizedViewModeKey;
        viewModeLabel = viewModeLabel == null || viewModeLabel.isBlank()
                ? labelForViewMode(normalizedViewModeKey)
                : viewModeLabel;
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
        overlay = overlay == null ? OverlayFrame.from(overlaySettings) : overlay;
        selectedToolKey = selectedToolKey == null || selectedToolKey.isBlank() ? SELECT_TOOL_KEY : selectedToolKey;
        selectedToolLabel = selectedToolLabel == null || selectedToolLabel.isBlank()
                ? DungeonEditorTool.SELECT.displayLabel()
                : selectedToolLabel;
        mapSurfaceFrame = mapSurfaceFrame == null ? MapSurfaceFrame.empty() : mapSurfaceFrame;
        mapInteractionFrame = mapInteractionFrame == null ? MapInteractionFrame.empty() : mapInteractionFrame;
        statePanelFrame = statePanelFrame == null ? StatePanelFrame.empty() : statePanelFrame;
    }

    public static DungeonEditorPreparedFrameFacts empty() {
        return new DungeonEditorPreparedFrameFacts(
                List.of(),
                "",
                0L,
                List.of(0),
                false,
                "",
                GRID_VIEW_MODE_KEY,
                "Grid",
                DungeonOverlaySettings.defaults(),
                OverlayFrame.from(DungeonOverlaySettings.defaults()),
                0,
                SELECT_TOOL_KEY,
                DungeonEditorTool.SELECT.displayLabel(),
                MapSurfaceFrame.empty(),
                MapInteractionFrame.empty(),
                StatePanelFrame.empty());
    }

    public static String normalizeViewModeKey(String viewModeKey) {
        return GRAPH_VIEW_MODE_KEY.equals(viewModeKey) || "Graph".equals(viewModeKey)
                ? GRAPH_VIEW_MODE_KEY
                : GRID_VIEW_MODE_KEY;
    }

    public static String labelForViewMode(String viewModeKey) {
        return GRAPH_VIEW_MODE_KEY.equals(normalizeViewModeKey(viewModeKey)) ? "Graph" : "Grid";
    }

    public record MapEntry(String key, long mapIdValue, String mapName, long revision) {
        public MapEntry {
            key = key == null ? "" : key;
            mapIdValue = Math.max(0L, mapIdValue);
            mapName = mapName == null || mapName.isBlank() ? "Dungeon Map" : mapName;
            revision = Math.max(0L, revision);
        }
    }

    public record OverlayFrame(
            String modeKey,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels,
            String selectedLevelsText,
            String overlayLabel
    ) {
        public OverlayFrame {
            modeKey = modeKey == null || modeKey.isBlank() ? "OFF" : modeKey;
            levelRange = Math.max(0, levelRange);
            opacity = Math.max(0.0, Math.min(1.0, opacity));
            selectedLevels = selectedLevels == null ? List.of() : List.copyOf(selectedLevels);
            selectedLevelsText = selectedLevelsText == null ? "" : selectedLevelsText.strip();
            overlayLabel = overlayLabel == null || overlayLabel.isBlank()
                    ? overlayLabelFor(modeKey)
                    : overlayLabel;
        }

        public static OverlayFrame from(DungeonOverlaySettings overlaySettings) {
            DungeonOverlaySettings safeOverlay =
                    Objects.requireNonNullElseGet(overlaySettings, DungeonOverlaySettings::defaults);
            List<Integer> selectedLevels = safeOverlay.selectedLevels();
            return new OverlayFrame(
                    safeOverlay.modeKey(),
                    safeOverlay.levelRange(),
                    safeOverlay.opacity(),
                    selectedLevels,
                    selectedLevels == null || selectedLevels.isEmpty()
                            ? ""
                            : selectedLevels.stream().map(String::valueOf).collect(Collectors.joining(", ")),
                    overlayLabelFor(safeOverlay.modeKey()));
        }

        private static String overlayLabelFor(String modeKey) {
            return switch (modeKey) {
                case "NEARBY" -> "Nahe Ebenen";
                case "SELECTED" -> "Ausgewählte Ebenen";
                default -> "Overlays aus";
            };
        }
    }

    public record MapSurfaceFrame(
            DungeonEditorSurface surface,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonEditorPreview preview,
            PreviewRenderFrame previewRender,
            PreviewRenderDiffFrame previewRenderDiff,
            DungeonEditorViewMode viewMode,
            DungeonOverlaySettings overlaySettings,
            int projectionLevel,
            DungeonEditorTool selectedTool
    ) {
        public MapSurfaceFrame {
            selection = selection == null ? DungeonEditorStateSnapshot.Selection.empty() : selection;
            preview = preview == null ? DungeonEditorPreview.none() : preview;
            previewRender = previewRender == null ? PreviewRenderFrame.empty() : previewRender;
            previewRenderDiff = previewRenderDiff == null ? PreviewRenderDiffFrame.empty() : previewRenderDiff;
            viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
            overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
            selectedTool = selectedTool == null ? DungeonEditorTool.SELECT : selectedTool;
        }

        public static MapSurfaceFrame empty() {
            return new MapSurfaceFrame(
                    null,
                    DungeonEditorStateSnapshot.Selection.empty(),
                    DungeonEditorPreview.none(),
                    PreviewRenderFrame.empty(),
                    PreviewRenderDiffFrame.empty(),
                    DungeonEditorViewMode.GRID,
                    DungeonOverlaySettings.defaults(),
                    0,
                    DungeonEditorTool.SELECT);
        }

        static MapSurfaceFrame from(
                DungeonEditorMapSurfaceSnapshot snapshot,
                String viewModeKey,
                DungeonOverlaySettings overlaySettings,
                int projectionLevel,
                String selectedToolKey
        ) {
            DungeonEditorMapSurfaceSnapshot safeSnapshot = snapshot == null
                    ? DungeonEditorMapSurfaceSnapshot.empty()
                    : snapshot;
            return new MapSurfaceFrame(
                    safeSnapshot.surface(),
                    safeSnapshot.selection(),
                    safeSnapshot.preview(),
                    PreviewRenderFrame.from(safeSnapshot),
                    PreviewRenderDiffFrame.from(safeSnapshot),
                    viewModeFor(viewModeKey),
                    overlaySettings,
                    projectionLevel,
                    toolFor(selectedToolKey));
        }

        private static DungeonEditorViewMode viewModeFor(String viewModeKey) {
            return GRAPH_VIEW_MODE_KEY.equals(normalizeViewModeKey(viewModeKey))
                    ? DungeonEditorViewMode.GRAPH
                    : DungeonEditorViewMode.GRID;
        }

        private static DungeonEditorTool toolFor(String selectedToolKey) {
            if (selectedToolKey == null || selectedToolKey.isBlank()) {
                return DungeonEditorTool.SELECT;
            }
            try {
                return DungeonEditorTool.valueOf(selectedToolKey);
            } catch (IllegalArgumentException ignored) {
                return DungeonEditorTool.SELECT;
            }
        }
    }

    public record PreviewRenderFrame(
            List<PreviewBoundaryEdgeFrame> boundaryEdges,
            List<PreviewStairCellFrame> stairCells,
            PreviewStairMarkerFrame stairMarker
    ) {
        public PreviewRenderFrame {
            boundaryEdges = copy(boundaryEdges);
            stairCells = copy(stairCells);
            stairMarker = stairMarker == null ? PreviewStairMarkerFrame.empty() : stairMarker;
        }

        public static PreviewRenderFrame empty() {
            return new PreviewRenderFrame(List.of(), List.of(), PreviewStairMarkerFrame.empty());
        }

        @Override
        public List<PreviewBoundaryEdgeFrame> boundaryEdges() {
            return copy(boundaryEdges);
        }

        @Override
        public List<PreviewStairCellFrame> stairCells() {
            return copy(stairCells);
        }

        public static PreviewRenderFrame from(DungeonEditorMapSurfaceSnapshot snapshot) {
            DungeonEditorMapSurfaceSnapshot safeSnapshot = snapshot == null
                    ? DungeonEditorMapSurfaceSnapshot.empty()
                    : snapshot;
            DungeonEditorPreview safePreview = safeSnapshot.preview() == null
                    ? DungeonEditorPreview.none()
                    : safeSnapshot.preview();
            if (safePreview instanceof DungeonEditorPreview.ClusterBoundariesPreview boundaryEdges) {
                return boundaryPreview(boundaryEdges);
            }
            if (safePreview instanceof DungeonEditorPreview.StairCreatePreview stairCreatePreview) {
                return stairPreview(stairCreatePreview);
            }
            return empty();
        }

        private static PreviewRenderFrame boundaryPreview(
                DungeonEditorPreview.ClusterBoundariesPreview preview
        ) {
            List<PreviewBoundaryEdgeFrame> edges = new ArrayList<>();
            PreparedBoundaryKind kind = "DOOR".equalsIgnoreCase(preview.boundaryKind())
                    ? PreparedBoundaryKind.DOOR
                    : PreparedBoundaryKind.WALL;
            String label = preview.deleteMode() ? "Delete preview" : "Boundary preview";
            for (var edge : copy(preview.edges())) {
                if (edge == null || edge.from() == null || edge.to() == null) {
                    continue;
                }
                edges.add(new PreviewBoundaryEdgeFrame(
                        edge.from().q(),
                        edge.from().r(),
                        edge.to().q(),
                        edge.to().r(),
                        edge.from().level(),
                        kind,
                        label,
                        preview.clusterId()));
            }
            return new PreviewRenderFrame(edges, List.of(), PreviewStairMarkerFrame.empty());
        }

        private static PreviewRenderFrame stairPreview(
                DungeonEditorPreview.StairCreatePreview preview
        ) {
            if (preview.valid()) {
                return empty();
            }
            List<PreviewStairCellFrame> cells = new ArrayList<>();
            var anchor = preview.anchor();
            var end = preview.end();
            addStairCell(cells, anchor, stairPreviewLabel(preview.shapeName()));
            if (!Objects.equals(anchor, end)) {
                addStairCell(cells, end, "Treppen-Ziel");
            }
            return new PreviewRenderFrame(
                    List.of(),
                    cells,
                    stairMarker(anchor));
        }

        private static void addStairCell(List<PreviewStairCellFrame> cells, DungeonCellRef cell, String label) {
            cells.add(new PreviewStairCellFrame(
                    cell != null,
                    cell == null ? 0 : cell.q(),
                    cell == null ? 0 : cell.r(),
                    cell == null ? 0 : cell.level(),
                    label));
        }

        private static PreviewStairMarkerFrame stairMarker(DungeonCellRef anchor) {
            return new PreviewStairMarkerFrame(
                    anchor != null,
                    anchor == null ? 0 : anchor.q(),
                    anchor == null ? 0 : anchor.r(),
                    anchor == null ? 0 : anchor.level(),
                    "z");
        }

        private static String stairPreviewLabel(String shapeName) {
            return switch (shapeName == null ? "" : shapeName.trim().toUpperCase(Locale.ROOT)) {
                case "SQUARE" -> "Treppen-Vorschau: Eckspirale";
                case "CIRCULAR" -> "Treppen-Vorschau: Rundspirale";
                default -> "Treppen-Vorschau: Gerade";
            };
        }

        private static <T> List<T> copy(List<T> values) {
            return values == null ? List.of() : List.copyOf(values);
        }
    }

    public record PreviewBoundaryEdgeFrame(
            int fromQ,
            int fromR,
            int toQ,
            int toR,
            int level,
            PreparedBoundaryKind boundaryKind,
            String label,
            long clusterId
    ) {
        public PreviewBoundaryEdgeFrame {
            boundaryKind = boundaryKind == null ? PreparedBoundaryKind.WALL : boundaryKind;
            label = label == null ? "" : label;
            clusterId = Math.max(0L, clusterId);
        }
    }

    public record PreviewStairCellFrame(
            boolean present,
            int q,
            int r,
            int level,
            String label
    ) {
        public PreviewStairCellFrame {
            label = label == null ? "" : label;
        }
    }

    public record PreviewStairMarkerFrame(
            boolean present,
            int q,
            int r,
            int level,
            String label
    ) {
        public PreviewStairMarkerFrame {
            label = label == null ? "" : label;
        }

        public static PreviewStairMarkerFrame empty() {
            return new PreviewStairMarkerFrame(false, 0, 0, 0, "");
        }
    }

    @SuppressWarnings("PMD.DataClass")
    public record PreviewRenderDiffFrame(
            List<PreviewAreaDiffFrame> changedAreas,
            List<PreviewAreaDiffFrame> removedAreas,
            List<PreviewBoundaryDiffFrame> changedBoundaries,
            List<PreviewBoundaryDiffFrame> removedBoundaries,
            List<PreviewHandleDiffFrame> changedHandles,
            List<PreviewHandleDiffFrame> removedHandles,
            List<PreviewFeatureDiffFrame> changedFeatures,
            List<PreviewFeatureDiffFrame> removedFeatures
    ) {
        public PreviewRenderDiffFrame {
            changedAreas = copy(changedAreas);
            removedAreas = copy(removedAreas);
            changedBoundaries = copy(changedBoundaries);
            removedBoundaries = copy(removedBoundaries);
            changedHandles = copy(changedHandles);
            removedHandles = copy(removedHandles);
            changedFeatures = copy(changedFeatures);
            removedFeatures = copy(removedFeatures);
        }

        public static PreviewRenderDiffFrame empty() {
            return new PreviewRenderDiffFrame(
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of());
        }

        @Override
        public List<PreviewAreaDiffFrame> changedAreas() {
            return copy(changedAreas);
        }

        @Override
        public List<PreviewAreaDiffFrame> removedAreas() {
            return copy(removedAreas);
        }

        @Override
        public List<PreviewBoundaryDiffFrame> changedBoundaries() {
            return copy(changedBoundaries);
        }

        @Override
        public List<PreviewBoundaryDiffFrame> removedBoundaries() {
            return copy(removedBoundaries);
        }

        @Override
        public List<PreviewHandleDiffFrame> changedHandles() {
            return copy(changedHandles);
        }

        @Override
        public List<PreviewHandleDiffFrame> removedHandles() {
            return copy(removedHandles);
        }

        @Override
        public List<PreviewFeatureDiffFrame> changedFeatures() {
            return copy(changedFeatures);
        }

        @Override
        public List<PreviewFeatureDiffFrame> removedFeatures() {
            return copy(removedFeatures);
        }

        public static PreviewRenderDiffFrame from(DungeonEditorMapSurfaceSnapshot snapshot) {
            return DungeonEditorPreviewRenderDiffAssembler.from(snapshot);
        }

        public boolean isEmpty() {
            return changedAreas.isEmpty()
                    && removedAreas.isEmpty()
                    && changedBoundaries.isEmpty()
                    && removedBoundaries.isEmpty()
                    && changedHandles.isEmpty()
                    && removedHandles.isEmpty()
                    && changedFeatures.isEmpty()
                    && removedFeatures.isEmpty();
        }

        private static <T> List<T> copy(List<T> values) {
            return values == null ? List.of() : List.copyOf(values);
        }
    }

    public record PreviewAreaDiffFrame(
            String kind,
            long id,
            long clusterId,
            String label,
            List<DungeonCellRef> cells,
            DungeonEditorTopologyElementRef topologyRef,
            boolean destructive
    ) {
        public PreviewAreaDiffFrame {
            kind = normalizedKind(kind, "ROOM");
            id = normalizedId(id);
            clusterId = Math.max(0L, clusterId);
            label = normalizedLabel(label, kind);
            cells = copy(cells);
            topologyRef = normalizedTopologyRef(topologyRef, kind, id);
        }

        @Override
        public List<DungeonCellRef> cells() {
            return copy(cells);
        }
    }

    public record PreviewBoundaryDiffFrame(
            String kind,
            long id,
            String label,
            DungeonEdgeRef edge,
            DungeonEditorTopologyElementRef topologyRef,
            boolean destructive
    ) {
        public PreviewBoundaryDiffFrame {
            kind = normalizedKind(kind, "boundary");
            id = normalizedId(id);
            label = normalizedLabel(label, kind);
            edge = edge == null ? emptyEdge() : edge;
            topologyRef = normalizedTopologyRef(topologyRef, kind, id);
        }
    }

    public record PreviewHandleDiffFrame(
            DungeonEditorHandleRef ref,
            String label,
            DungeonCellRef cell,
            double markerQ,
            double markerR,
            boolean destructive
    ) {
        public PreviewHandleDiffFrame {
            ref = ref == null ? DungeonEditorHandleRef.empty() : ref;
            label = label == null || label.isBlank() ? ref.kind().name() : label.trim();
            cell = cell == null ? ref.cell() : cell;
            markerQ = Double.isFinite(markerQ) ? markerQ : cell.q();
            markerR = Double.isFinite(markerR) ? markerR : cell.r();
        }
    }

    public record PreviewFeatureDiffFrame(
            String kind,
            long id,
            String label,
            List<DungeonCellRef> cells,
            String description,
            String destinationLabel,
            DungeonEditorTopologyElementRef topologyRef,
            DungeonEdgeRef anchorEdge,
            boolean destructive
    ) {
        public PreviewFeatureDiffFrame {
            kind = normalizedKind(kind, "STAIR");
            id = normalizedId(id);
            label = normalizedLabel(label, kind);
            cells = copy(cells);
            description = description == null ? "" : description.trim();
            destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
            topologyRef = normalizedTopologyRef(topologyRef, kind, id);
        }

        @Override
        public List<DungeonCellRef> cells() {
            return copy(cells);
        }
    }

    private static String normalizedKind(String kind, String fallback) {
        return kind == null || kind.isBlank() ? fallback : kind.trim();
    }

    private static String normalizedLabel(String label, String fallback) {
        return label == null || label.isBlank() ? fallback : label.trim();
    }

    private static long normalizedId(long id) {
        return Math.max(1L, id);
    }

    private static DungeonEditorTopologyElementRef normalizedTopologyRef(
            DungeonEditorTopologyElementRef topologyRef,
            String kind,
            long id
    ) {
        return topologyRef == null
                ? new DungeonEditorTopologyElementRef(kind.toUpperCase(Locale.ROOT), id)
                : topologyRef;
    }

    private static DungeonEdgeRef emptyEdge() {
        return new DungeonEdgeRef(new DungeonCellRef(0, 0, 0), new DungeonCellRef(0, 0, 0));
    }

    private static <T> List<T> copy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    public record MapInteractionFrame(
            Map<String, PreparedPointerTargetFrame> pointerTargets,
            List<String> previewHandleHitRefs
    ) {
        public MapInteractionFrame {
            pointerTargets = pointerTargets == null ? Map.of() : Map.copyOf(pointerTargets);
            previewHandleHitRefs = previewHandleHitRefs == null ? List.of() : List.copyOf(previewHandleHitRefs);
        }

        public static MapInteractionFrame empty() {
            return new MapInteractionFrame(Map.of(), List.of());
        }

        public static MapInteractionFrame from(DungeonEditorMapSurfaceSnapshot snapshot) {
            return DungeonEditorMapInteractionFrameAssembler.from(snapshot);
        }
    }

    public record PreparedPointerTargetFrame(
            PreparedTargetKind targetKind,
            PreparedLabelKind labelKind,
            PreparedElementKind elementKind,
            long ownerId,
            long clusterId,
            PreparedTopologyKind topologyKind,
            long topologyId,
            DungeonEditorHandleRef handleRef,
            PreparedBoundaryTargetFrame boundary,
            PreparedSyntheticHoverKind syntheticHoverKind,
            PreparedCellTargetFrame cell,
            PreparedVertexTargetFrame vertex
    ) {
        public PreparedPointerTargetFrame {
            targetKind = targetKind == null ? PreparedTargetKind.EMPTY : targetKind;
            labelKind = labelKind == null ? PreparedLabelKind.EMPTY : labelKind;
            elementKind = elementKind == null ? PreparedElementKind.EMPTY : elementKind;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyKind = topologyKind == null ? PreparedTopologyKind.EMPTY : topologyKind;
            topologyId = Math.max(0L, topologyId);
            handleRef = handleRef == null ? DungeonEditorHandleRef.empty() : handleRef;
            boundary = boundary == null ? PreparedBoundaryTargetFrame.empty() : boundary;
            syntheticHoverKind = syntheticHoverKind == null ? PreparedSyntheticHoverKind.NONE : syntheticHoverKind;
            cell = cell == null ? PreparedCellTargetFrame.empty() : cell;
            vertex = vertex == null ? PreparedVertexTargetFrame.empty() : vertex;
        }

        public static PreparedPointerTargetFrame empty() {
            return fromRuntime(DungeonEditorRuntimePointerTarget.empty());
        }

        static PreparedPointerTargetFrame fromRuntime(DungeonEditorRuntimePointerTarget target) {
            DungeonEditorRuntimePointerTarget safeTarget = target == null
                    ? DungeonEditorRuntimePointerTarget.empty()
                    : target;
            return new PreparedPointerTargetFrame(
                    PreparedTargetKind.fromRuntime(safeTarget.targetKind()),
                    PreparedLabelKind.fromRuntime(safeTarget.labelKind()),
                    PreparedElementKind.fromRuntime(safeTarget.elementKind()),
                    safeTarget.ownerId(),
                    safeTarget.clusterId(),
                    PreparedTopologyKind.fromRuntime(safeTarget.topologyKind()),
                    safeTarget.topologyId(),
                    safeTarget.handleRef(),
                    PreparedBoundaryTargetFrame.fromRuntime(safeTarget.boundary()),
                    PreparedSyntheticHoverKind.fromRuntime(safeTarget.syntheticHoverKind()),
                    new PreparedCellTargetFrame(
                            safeTarget.cell().exact(),
                            safeTarget.cellQ(),
                            safeTarget.cellR(),
                            safeTarget.cellLevel()),
                    new PreparedVertexTargetFrame(
                            safeTarget.isVertexTarget() && safeTarget.vertex().exact(),
                            safeTarget.vertexQ(),
                            safeTarget.vertexR(),
                            safeTarget.vertexLevel()));
        }
    }

    public record PreparedBoundaryTargetFrame(
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
        public PreparedBoundaryTargetFrame {
            boundaryKind = boundaryKind == null ? PreparedBoundaryKind.WALL : boundaryKind;
            key = key == null ? "" : key.strip();
            ownerId = Math.max(0L, ownerId);
            topologyKind = topologyKind == null ? PreparedTopologyKind.EMPTY : topologyKind;
            topologyId = Math.max(0L, topologyId);
            startQ = Double.isFinite(startQ) ? startQ : 0.0;
            startR = Double.isFinite(startR) ? startR : 0.0;
            endQ = Double.isFinite(endQ) ? endQ : 0.0;
            endR = Double.isFinite(endR) ? endR : 0.0;
        }

        public static PreparedBoundaryTargetFrame empty() {
            return fromRuntime(DungeonEditorRuntimePointerTarget.BoundaryTarget.empty());
        }

        static PreparedBoundaryTargetFrame fromRuntime(
                DungeonEditorRuntimePointerTarget.BoundaryTarget boundary
        ) {
            DungeonEditorRuntimePointerTarget.BoundaryTarget safeBoundary = boundary == null
                    ? DungeonEditorRuntimePointerTarget.BoundaryTarget.empty()
                    : boundary;
            return new PreparedBoundaryTargetFrame(
                    PreparedBoundaryKind.fromRuntime(safeBoundary.boundaryKind()),
                    safeBoundary.key(),
                    safeBoundary.ownerId(),
                    PreparedTopologyKind.fromRuntime(safeBoundary.topologyKind()),
                    safeBoundary.topologyId(),
                    safeBoundary.startQ(),
                    safeBoundary.startR(),
                    safeBoundary.startLevel(),
                    safeBoundary.endQ(),
                    safeBoundary.endR(),
                    safeBoundary.endLevel());
        }
    }

    public record PreparedCellTargetFrame(boolean exact, int q, int r, int level) {
        public static PreparedCellTargetFrame empty() {
            return new PreparedCellTargetFrame(false, 0, 0, 0);
        }
    }

    public record PreparedVertexTargetFrame(boolean exact, int q, int r, int level) {
        public static PreparedVertexTargetFrame empty() {
            return new PreparedVertexTargetFrame(false, 0, 0, 0);
        }
    }

    public enum PreparedTargetKind {
        EMPTY,
        CELL,
        LABEL,
        MARKER,
        GRAPH_NODE,
        HANDLE,
        BOUNDARY,
        VERTEX;

        static PreparedTargetKind fromRuntime(DungeonEditorRuntimePointerTarget.TargetKind targetKind) {
            if (targetKind == null) {
                return EMPTY;
            }
            return switch (targetKind) {
                case CELL -> CELL;
                case LABEL -> LABEL;
                case MARKER -> MARKER;
                case GRAPH_NODE -> GRAPH_NODE;
                case HANDLE -> HANDLE;
                case BOUNDARY -> BOUNDARY;
                case VERTEX -> VERTEX;
                default -> EMPTY;
            };
        }
    }

    public enum PreparedLabelKind {
        EMPTY,
        ROOM_LABEL,
        CLUSTER_LABEL,
        FEATURE_LABEL;

        static PreparedLabelKind fromRuntime(DungeonEditorRuntimePointerTarget.LabelKind labelKind) {
            if (labelKind == null) {
                return EMPTY;
            }
            return switch (labelKind) {
                case ROOM_LABEL -> ROOM_LABEL;
                case CLUSTER_LABEL -> CLUSTER_LABEL;
                case FEATURE_LABEL -> FEATURE_LABEL;
                default -> EMPTY;
            };
        }
    }

    public enum PreparedElementKind {
        EMPTY,
        ROOM,
        CORRIDOR,
        CORRIDOR_ANCHOR,
        STAIR,
        TRANSITION,
        FEATURE_MARKER,
        FEATURE_OBJECT,
        FEATURE_ENCOUNTER,
        FEATURE_POI,
        WALL,
        DOOR,
        WALL_VERTEX;

        @SuppressWarnings("PMD.CyclomaticComplexity")
        static PreparedElementKind fromRuntime(DungeonEditorRuntimePointerTarget.ElementKind elementKind) {
            if (elementKind == null) {
                return EMPTY;
            }
            return switch (elementKind) {
                case ROOM -> ROOM;
                case CORRIDOR -> CORRIDOR;
                case CORRIDOR_ANCHOR -> CORRIDOR_ANCHOR;
                case STAIR -> STAIR;
                case TRANSITION -> TRANSITION;
                case FEATURE_MARKER -> FEATURE_MARKER;
                case FEATURE_OBJECT -> FEATURE_OBJECT;
                case FEATURE_ENCOUNTER -> FEATURE_ENCOUNTER;
                case FEATURE_POI -> FEATURE_POI;
                case WALL -> WALL;
                case DOOR -> DOOR;
                case WALL_VERTEX -> WALL_VERTEX;
                default -> EMPTY;
            };
        }
    }

    public enum PreparedTopologyKind {
        EMPTY,
        ROOM,
        CORRIDOR,
        CORRIDOR_ANCHOR,
        DOOR,
        WALL,
        STAIR,
        TRANSITION,
        FEATURE_MARKER;

        @SuppressWarnings("PMD.CyclomaticComplexity")
        static PreparedTopologyKind fromRuntime(DungeonEditorRuntimePointerTarget.TopologyKind topologyKind) {
            if (topologyKind == null) {
                return EMPTY;
            }
            return switch (topologyKind) {
                case ROOM -> ROOM;
                case CORRIDOR -> CORRIDOR;
                case CORRIDOR_ANCHOR -> CORRIDOR_ANCHOR;
                case DOOR -> DOOR;
                case WALL -> WALL;
                case STAIR -> STAIR;
                case TRANSITION -> TRANSITION;
                case FEATURE_MARKER -> FEATURE_MARKER;
                default -> EMPTY;
            };
        }
    }

    public enum PreparedSyntheticHoverKind {
        NONE,
        CELL,
        BOUNDARY,
        VERTEX;

        static PreparedSyntheticHoverKind fromRuntime(
                DungeonEditorRuntimePointerTarget.SyntheticHoverKind syntheticHoverKind
        ) {
            if (syntheticHoverKind == null) {
                return NONE;
            }
            return switch (syntheticHoverKind) {
                case CELL -> CELL;
                case BOUNDARY -> BOUNDARY;
                case VERTEX -> VERTEX;
                default -> NONE;
            };
        }
    }

    public enum PreparedBoundaryKind {
        WALL,
        DOOR;

        @SuppressWarnings("PMD.LawOfDemeter")
        static PreparedBoundaryKind fromRuntime(DungeonEditorRuntimePointerTarget.BoundaryKind boundaryKind) {
            return boundaryKind == DungeonEditorRuntimePointerTarget.BoundaryKind.DOOR ? DOOR : WALL;
        }
    }

    public record StatePanelFrame(
            long selectedMapIdValue,
            String statusText,
            boolean busy,
            String selectedToolLabel,
            String selectedToolKey,
            String viewModeLabel,
            int projectionLevel,
            String overlayLabel,
            DungeonInspectorSnapshot inspector,
            DungeonEditorTopologyElementRef selectionTopologyRef,
            long selectedTransitionId,
            DungeonEditorPreview preview,
            DungeonEditorStatePanelRoomNarrationDrafts.VisibleDrafts roomNarrationDrafts,
            DungeonEditorStatePanelLabelNameDrafts.Draft labelNameDraft,
            DungeonEditorStatePanelCorridorPointDrafts.Draft corridorPointDraft,
            DungeonEditorStatePanelTransitionDescriptionDrafts.Draft transitionDescriptionDraft,
            DungeonEditorStatePanelTransitionDestinationDrafts.Draft transitionDestinationDraft,
            TransitionDestination transitionDestination,
            DungeonEditorStatePanelStairGeometryDrafts.Draft stairGeometryDraft
    ) {
        public StatePanelFrame {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            statusText = statusText == null ? "" : statusText;
            selectedToolLabel = selectedToolLabel == null || selectedToolLabel.isBlank()
                    ? DungeonEditorTool.SELECT.displayLabel()
                    : selectedToolLabel;
            selectedToolKey = selectedToolKey == null || selectedToolKey.isBlank() ? SELECT_TOOL_KEY : selectedToolKey;
            viewModeLabel = viewModeLabel == null || viewModeLabel.isBlank()
                    ? labelForViewMode(GRID_VIEW_MODE_KEY)
                    : viewModeLabel;
            overlayLabel = overlayLabel == null ? "" : overlayLabel;
            selectionTopologyRef = selectionTopologyRef == null
                    ? DungeonEditorTopologyElementRef.empty()
                    : selectionTopologyRef;
            selectedTransitionId = Math.max(0L, selectedTransitionId);
            preview = preview == null ? DungeonEditorPreview.none() : preview;
            roomNarrationDrafts = roomNarrationDrafts == null
                    ? DungeonEditorStatePanelRoomNarrationDrafts.VisibleDrafts.empty()
                    : roomNarrationDrafts;
            labelNameDraft = labelNameDraft == null
                    ? DungeonEditorStatePanelLabelNameDrafts.Draft.empty()
                    : labelNameDraft;
            corridorPointDraft = corridorPointDraft == null
                    ? DungeonEditorStatePanelCorridorPointDrafts.Draft.empty()
                    : corridorPointDraft;
            transitionDescriptionDraft = transitionDescriptionDraft == null
                    ? DungeonEditorStatePanelTransitionDescriptionDrafts.Draft.empty()
                    : transitionDescriptionDraft;
            transitionDestinationDraft = transitionDestinationDraft == null
                    ? DungeonEditorStatePanelTransitionDestinationDrafts.Draft.empty()
                    : transitionDestinationDraft;
            transitionDestination = transitionDestination == null
                    ? TransitionDestination.empty()
                    : transitionDestination;
            stairGeometryDraft = stairGeometryDraft == null
                    ? DungeonEditorStatePanelStairGeometryDrafts.Draft.empty()
                    : stairGeometryDraft;
        }

        public static StatePanelFrame empty() {
            return new StatePanelFrame(
                    0L,
                    "",
                    false,
                    DungeonEditorTool.SELECT.displayLabel(),
                    SELECT_TOOL_KEY,
                    labelForViewMode(GRID_VIEW_MODE_KEY),
                    0,
                    "",
                    null,
                    DungeonEditorTopologyElementRef.empty(),
                    0L,
                    DungeonEditorPreview.none(),
                    DungeonEditorStatePanelRoomNarrationDrafts.VisibleDrafts.empty(),
                    DungeonEditorStatePanelLabelNameDrafts.Draft.empty(),
                    DungeonEditorStatePanelCorridorPointDrafts.Draft.empty(),
                    DungeonEditorStatePanelTransitionDescriptionDrafts.Draft.empty(),
                    DungeonEditorStatePanelTransitionDestinationDrafts.Draft.empty(),
                    TransitionDestination.empty(),
                    DungeonEditorStatePanelStairGeometryDrafts.Draft.empty());
        }

        static long selectedTransitionId(DungeonEditorStateSnapshot.Selection selection) {
            DungeonEditorTopologyElementRef topologyRef = selection == null
                    ? DungeonEditorTopologyElementRef.empty()
                    : selection.topologyRef();
            return "TRANSITION".equals(topologyRef.kind()) ? topologyRef.id() : 0L;
        }

        static TransitionDestination transitionDestinationFor(
                long selectedMapIdValue,
                String selectedToolKey,
                long selectedTransitionId,
                DungeonEditorStatePanelTransitionDestinationDrafts.Draft transitionDestinationDraft
        ) {
            if (selectedMapIdValue <= NO_SELECTED_MAP_ID) {
                return TransitionDestination.empty();
            }
            if (!TRANSITION_CREATE_TOOL.equals(selectedToolKey) && selectedTransitionId <= NO_TRANSITION_ID) {
                return TransitionDestination.empty();
            }
            DungeonEditorStatePanelTransitionDestinationDrafts.Draft runtimeDraft =
                    transitionDestinationDraft == null
                            ? DungeonEditorStatePanelTransitionDestinationDrafts.Draft.empty()
                            : transitionDestinationDraft;
            if (!runtimeDraft.targetPresent()) {
                return TransitionDestination.empty();
            }
            if (runtimeDraft.present()) {
                return TransitionDestination.fromDraft(
                        runtimeDraft.destinationType(),
                        runtimeDraft.mapId(),
                        runtimeDraft.tileId(),
                        runtimeDraft.transitionId());
            }
            return TransitionDestination.empty();
        }

    }

}
