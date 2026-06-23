package src.features.dungeon.runtime;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapHitRef;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorSurface;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonTopologyElementRef;

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
        MapInteractionFrame mapInteractionFrame
) {
    private static final String EMPTY_KIND = "EMPTY";
    private static final String EMPTY_LABEL_KIND = EMPTY_KIND;
    private static final String CLUSTER_LABEL_KIND = "CLUSTER_LABEL";
    private static final String FEATURE_LABEL_KIND = "FEATURE_LABEL";

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
        projectionLevel = Math.max(0, projectionLevel);
        selectedToolKey = selectedToolKey == null || selectedToolKey.isBlank() ? "SELECT" : selectedToolKey;
        selectedToolLabel = selectedToolLabel == null || selectedToolLabel.isBlank()
                ? DungeonEditorToolFrameLabels.SELECT
                : selectedToolLabel;
        mapInteractionFrame = mapInteractionFrame == null ? MapInteractionFrame.empty() : mapInteractionFrame;
    }

    public static DungeonEditorPreparedFrameFacts empty() {
        return new DungeonEditorPreparedFrameFacts(
                List.of(),
                "",
                0L,
                List.of(0),
                false,
                "",
                "GRID",
                "Grid",
                DungeonOverlaySettings.defaults(),
                OverlayFrame.from(DungeonOverlaySettings.defaults()),
                0,
                "SELECT",
                DungeonEditorToolFrameLabels.SELECT,
                MapInteractionFrame.empty());
    }

    public static String normalizeViewModeKey(String viewModeKey) {
        return "GRAPH".equals(viewModeKey) || "Graph".equals(viewModeKey) ? "GRAPH" : "GRID";
    }

    public static String labelForViewMode(String viewModeKey) {
        return "GRAPH".equals(normalizeViewModeKey(viewModeKey)) ? "Graph" : "Grid";
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

    public record MapInteractionFrame(Map<String, PointerTarget> pointerTargets) {
        public MapInteractionFrame {
            pointerTargets = pointerTargets == null ? Map.of() : Map.copyOf(pointerTargets);
        }

        public static MapInteractionFrame empty() {
            return new MapInteractionFrame(Map.of());
        }

        public static MapInteractionFrame from(DungeonEditorMapSurfaceSnapshot snapshot) {
            DungeonEditorMapSurfaceSnapshot safeSnapshot = snapshot == null
                    ? DungeonEditorMapSurfaceSnapshot.empty()
                    : snapshot;
            DungeonEditorSurface surface = safeSnapshot.surface();
            if (surface == null) {
                return empty();
            }
            Map<String, PointerTarget> targets = new LinkedHashMap<>();
            DungeonEditorMapSnapshot map = surface.map();
            DungeonEditorStateSnapshot.Selection selection = safeSnapshot.selection();
            if (safeSnapshot.viewMode() == DungeonEditorViewMode.GRAPH) {
                addGraphTargets(targets, map);
            } else {
                addGridTargets(targets, map, selection, safeSnapshot.preview(), safeSnapshot);
            }
            return new MapInteractionFrame(targets);
        }

        private static void addGridTargets(
                Map<String, PointerTarget> targets,
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection,
                DungeonEditorPreview preview,
                DungeonEditorMapSurfaceSnapshot snapshot
        ) {
            addAreaCellTargets(targets, map, snapshot);
            addFeatureCellTargets(targets, map, snapshot);
            addBoundaryTargets(targets, map, snapshot);
            addHandlePointerEntries(targets, map, selection, preview, snapshot);
            addClusterLabelTargets(targets, map, snapshot);
            addFeatureLabelTargets(targets, map, snapshot);
        }

        private static void addAreaCellTargets(
                Map<String, PointerTarget> targets,
                DungeonEditorMapSnapshot map,
                DungeonEditorMapSurfaceSnapshot snapshot
        ) {
            for (DungeonEditorMapSnapshot.Area area : map.areas()) {
                String elementKind = areaElementKind(area);
                for (DungeonCellRef cell : area.cells()) {
                    if (includeLevel(snapshot, cell.level())) {
                        targets.put(DungeonEditorMapHitRef.cell(
                                        elementKind,
                                        area.id(),
                                        area.clusterId(),
                                        area.topologyRef()).value(),
                                PointerTarget.cell(elementKind, area.id(), area.clusterId(), area.topologyRef()));
                    }
                }
            }
        }

        private static void addFeatureCellTargets(
                Map<String, PointerTarget> targets,
                DungeonEditorMapSnapshot map,
                DungeonEditorMapSurfaceSnapshot snapshot
        ) {
            for (DungeonEditorMapSnapshot.Feature feature : map.features()) {
                for (DungeonCellRef cell : feature.cells()) {
                    if (includeLevel(snapshot, cell.level())) {
                        String hitElementKind = featureCellKind(feature.kind());
                        String targetElementKind = featurePointerElementKind(hitElementKind);
                        targets.put(DungeonEditorMapHitRef.cell(
                                        hitElementKind,
                                        feature.id(),
                                        0L,
                                        feature.topologyRef()).value(),
                                PointerTarget.cell(
                                        targetElementKind,
                                        feature.id(),
                                        0L,
                                        feature.topologyRef()));
                    }
                }
            }
        }

        private static void addBoundaryTargets(
                Map<String, PointerTarget> targets,
                DungeonEditorMapSnapshot map,
                DungeonEditorMapSurfaceSnapshot snapshot
        ) {
            for (DungeonEditorMapSnapshot.Boundary boundary : map.boundaries()) {
                DungeonEdgeRef edge = boundary.edge();
                if (invalidEdge(edge) || !includeLevel(snapshot, edge.from().level())) {
                    continue;
                }
                String kind = boundaryKind(boundary.kind());
                BoundaryTarget target = new BoundaryTarget(
                        kind,
                        boundaryKey(kind, boundary.id(), boundary.topologyRef(), edge),
                        boundary.id(),
                        DungeonEditorMapHitRef.topologyKind(boundary.topologyRef()),
                        DungeonEditorMapHitRef.topologyId(boundary.topologyRef()),
                        edge.from().q(),
                        edge.from().r(),
                        edge.from().level(),
                        edge.to().q(),
                        edge.to().r(),
                        edge.to().level());
                targets.put(DungeonEditorMapHitRef.edge(kind, boundary.id(), boundary.topologyRef(), edge).value(),
                        PointerTarget.boundary(target));
            }
        }

        private static void addHandlePointerEntries(
                Map<String, PointerTarget> targets,
                DungeonEditorMapSnapshot map,
                DungeonEditorStateSnapshot.Selection selection,
                DungeonEditorPreview preview,
                DungeonEditorMapSurfaceSnapshot snapshot
        ) {
            for (DungeonEditorHandleSnapshot handle : map.editorHandles()) {
                DungeonEditorHandleRef ref = handle.ref();
                if (!visibleCanvasHandle(ref, selection)
                        || movingPreviewHandle(ref, preview)
                        || !includeLevel(snapshot, handle.cell().level())) {
                    continue;
                }
                String hitRef = DungeonEditorMapHitRef.marker(ref, handle.cell()).value();
                if (!hitRef.isBlank()) {
                    targets.put(hitRef, PointerTarget.handle(ref));
                }
            }
        }

        private static void addClusterLabelTargets(
                Map<String, PointerTarget> targets,
                DungeonEditorMapSnapshot map,
                DungeonEditorMapSurfaceSnapshot snapshot
        ) {
            List<Long> renderedClusterIds = new ArrayList<>();
            for (DungeonEditorHandleSnapshot handle : map.editorHandles()) {
                DungeonEditorHandleRef ref = handle.ref();
                if (!ref.kind().isClusterLabel()
                        || ref.clusterId() <= 0L
                        || renderedClusterIds.contains(ref.clusterId())
                        || !includeLevel(snapshot, handle.cell().level())) {
                    continue;
                }
                renderedClusterIds.add(ref.clusterId());
                targets.put(DungeonEditorMapHitRef.label(
                                ref.ownerId(),
                                ref.clusterId(),
                                ref.topologyRef(),
                                CLUSTER_LABEL_KIND).value(),
                        PointerTarget.label(
                                CLUSTER_LABEL_KIND,
                                ref.ownerId(),
                                ref.clusterId(),
                                ref.topologyRef()));
            }
        }

        private static void addFeatureLabelTargets(
                Map<String, PointerTarget> targets,
                DungeonEditorMapSnapshot map,
                DungeonEditorMapSurfaceSnapshot snapshot
        ) {
            for (DungeonEditorMapSnapshot.Feature feature : map.features()) {
                if (feature.cells().isEmpty() || !includeLevel(snapshot, feature.cells().getFirst().level())) {
                    continue;
                }
                targets.put(DungeonEditorMapHitRef.label(
                                feature.id(),
                                0L,
                                feature.topologyRef(),
                                FEATURE_LABEL_KIND).value(),
                        PointerTarget.label(FEATURE_LABEL_KIND, feature.id(), 0L, feature.topologyRef()));
            }
        }

        private static void addGraphTargets(Map<String, PointerTarget> targets, DungeonEditorMapSnapshot map) {
            for (DungeonEditorMapSnapshot.Area area : map.areas()) {
                if (!area.cells().isEmpty()) {
                    targets.put(DungeonEditorMapHitRef.graphNode(area.id(), area.clusterId()).value(),
                            PointerTarget.graphNode(area.id(), area.clusterId(), "ROOM", area.id()));
                }
            }
        }

        private static boolean includeLevel(DungeonEditorMapSurfaceSnapshot snapshot, int level) {
            if (level == snapshot.projectionLevel()) {
                return true;
            }
            DungeonOverlaySettings settings = snapshot.overlaySettings();
            return switch (settings.modeKey()) {
                case "NEARBY" -> Math.abs(level - snapshot.projectionLevel()) <= settings.levelRange();
                case "SELECTED" -> settings.selectedLevels().contains(level);
                default -> false;
            };
        }

        private static boolean visibleCanvasHandle(
                DungeonEditorHandleRef ref,
                DungeonEditorStateSnapshot.Selection selection
        ) {
            if (ref.kind().isClusterLabel() || ref.kind().isCorridorGeometryHandle()) {
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

        private static boolean movingPreviewHandle(DungeonEditorHandleRef ref, DungeonEditorPreview preview) {
            return preview instanceof DungeonEditorPreview.MoveHandlePreview handlePreview
                    && sameHandleRef(ref, handlePreview.handleRef());
        }

        private static boolean sameHandleRef(DungeonEditorHandleRef first, DungeonEditorHandleRef second) {
            return first != null
                    && second != null
                    && first.kind() == second.kind()
                    && Objects.equals(first.topologyRef(), second.topologyRef())
                    && first.ownerId() == second.ownerId()
                    && first.clusterId() == second.clusterId()
                    && first.corridorId() == second.corridorId()
                    && first.roomId() == second.roomId()
                    && first.index() == second.index();
        }

        private static String boundaryKey(
                String kind,
                long ownerId,
                DungeonEditorTopologyElementRef topologyRef,
                DungeonEdgeRef edge
        ) {
            return kind + ":"
                    + ownerId + ":"
                    + DungeonEditorMapHitRef.topologyKind(topologyRef) + ":"
                    + DungeonEditorMapHitRef.topologyId(topologyRef) + ":"
                    + (double) edge.from().q() + ":"
                    + (double) edge.from().r() + ":"
                    + edge.from().level() + ":"
                    + (double) edge.to().q() + ":"
                    + (double) edge.to().r() + ":"
                    + edge.to().level();
        }

        private static String areaElementKind(DungeonEditorMapSnapshot.Area area) {
            return "CORRIDOR".equalsIgnoreCase(area.kind()) ? "CORRIDOR" : "ROOM";
        }

        private static String featureCellKind(String kind) {
            return switch (kind == null ? "" : kind.trim().toUpperCase(java.util.Locale.ROOT)) {
                case "OBJECT" -> "FEATURE_OBJECT";
                case "ENCOUNTER" -> "FEATURE_ENCOUNTER";
                case "POI" -> "FEATURE_POI";
                case "TRANSITION" -> "TRANSITION";
                default -> "STAIR";
            };
        }

        private static String featurePointerElementKind(String cellKind) {
            return switch (cellKind) {
                case "FEATURE_OBJECT", "FEATURE_ENCOUNTER", "FEATURE_POI" -> "FEATURE_MARKER";
                default -> cellKind;
            };
        }

        private static String boundaryKind(String kind) {
            return "DOOR".equalsIgnoreCase(kind) ? "DOOR" : "WALL";
        }

        private static boolean invalidEdge(DungeonEdgeRef edge) {
            return edge == null || edge.from() == null || edge.to() == null;
        }

    }

    public record PointerTarget(
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
        public PointerTarget {
            targetKind = targetKind == null || targetKind.isBlank() ? EMPTY_KIND : targetKind.strip();
            labelKind = labelKind == null || labelKind.isBlank() ? EMPTY_LABEL_KIND : labelKind.strip();
            elementKind = elementKind == null || elementKind.isBlank() ? EMPTY_KIND : elementKind.strip();
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyKind = topologyKind == null || topologyKind.isBlank() ? EMPTY_KIND : topologyKind.strip();
            topologyId = Math.max(0L, topologyId);
            handleRef = handleRef == null ? DungeonEditorHandleRef.empty() : handleRef;
            boundaryRef = boundaryRef == null ? BoundaryTarget.empty() : boundaryRef;
        }

        static PointerTarget cell(
                String elementKind,
                long ownerId,
                long clusterId,
                DungeonEditorTopologyElementRef topologyRef
        ) {
            return new PointerTarget(
                    "CELL",
                    EMPTY_LABEL_KIND,
                    elementKind,
                    ownerId,
                    clusterId,
                    DungeonEditorMapHitRef.topologyKind(topologyRef),
                    DungeonEditorMapHitRef.topologyId(topologyRef),
                    DungeonEditorHandleRef.empty(),
                    BoundaryTarget.empty());
        }

        static PointerTarget label(
                String labelKind,
                long ownerId,
                long clusterId,
                DungeonEditorTopologyElementRef topologyRef
        ) {
            return new PointerTarget(
                    "LABEL",
                    labelKind,
                    DungeonEditorMapHitRef.topologyKind(topologyRef),
                    ownerId,
                    clusterId,
                    DungeonEditorMapHitRef.topologyKind(topologyRef),
                    DungeonEditorMapHitRef.topologyId(topologyRef),
                    DungeonEditorHandleRef.empty(),
                    BoundaryTarget.empty());
        }

        static PointerTarget label(
                String labelKind,
                long ownerId,
                long clusterId,
                DungeonTopologyElementRef topologyRef
        ) {
            return new PointerTarget(
                    "LABEL",
                    labelKind,
                    DungeonEditorMapHitRef.topologyKind(topologyRef),
                    ownerId,
                    clusterId,
                    DungeonEditorMapHitRef.topologyKind(topologyRef),
                    DungeonEditorMapHitRef.topologyId(topologyRef),
                    DungeonEditorHandleRef.empty(),
                    BoundaryTarget.empty());
        }

        static PointerTarget graphNode(
                long ownerId,
                long clusterId,
                String topologyKind,
                long topologyId
        ) {
            return new PointerTarget(
                    "GRAPH_NODE",
                    EMPTY_LABEL_KIND,
                    topologyKind,
                    ownerId,
                    clusterId,
                    topologyKind,
                    topologyId,
                    DungeonEditorHandleRef.empty(),
                    BoundaryTarget.empty());
        }

        static PointerTarget handle(DungeonEditorHandleRef handleRef) {
            DungeonEditorHandleRef safeHandle = handleRef == null ? DungeonEditorHandleRef.empty() : handleRef;
            return new PointerTarget(
                    "HANDLE",
                    EMPTY_LABEL_KIND,
                    safeHandle.topologyRef().kind().name(),
                    safeHandle.ownerId(),
                    safeHandle.clusterId(),
                    safeHandle.topologyRef().kind().name(),
                    safeHandle.topologyRef().id(),
                    safeHandle,
                    BoundaryTarget.empty());
        }

        static PointerTarget boundary(BoundaryTarget boundaryRef) {
            BoundaryTarget safeBoundary = boundaryRef == null ? BoundaryTarget.empty() : boundaryRef;
            return new PointerTarget(
                    "BOUNDARY",
                    EMPTY_LABEL_KIND,
                    safeBoundary.topologyKind(),
                    safeBoundary.ownerId(),
                    0L,
                    safeBoundary.topologyKind(),
                    safeBoundary.topologyId(),
                    DungeonEditorHandleRef.empty(),
                    safeBoundary);
        }
    }

    public record BoundaryTarget(
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
        public BoundaryTarget {
            kind = kind == null || kind.isBlank() ? "WALL" : kind.strip();
            key = key == null ? "" : key.strip();
            ownerId = Math.max(0L, ownerId);
            topologyKind = topologyKind == null || topologyKind.isBlank() ? EMPTY_KIND : topologyKind.strip();
            topologyId = Math.max(0L, topologyId);
        }

        static BoundaryTarget empty() {
            return new BoundaryTarget("WALL", "", 0L, EMPTY_KIND, 0L, 0.0, 0.0, 0, 0.0, 0.0, 0);
        }
    }
}
