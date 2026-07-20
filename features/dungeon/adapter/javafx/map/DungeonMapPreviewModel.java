package features.dungeon.adapter.javafx.map;

import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.DungeonEditorHandleRef;
import features.dungeon.api.DungeonEditorHandleSnapshot;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonEditorPreview;
import features.dungeon.api.DungeonEditorSurface;
import features.dungeon.api.DungeonTopologyElementRef;
import features.dungeon.api.editor.DungeonEditorState;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;

final class DungeonMapPreviewModel {
    private DungeonMapPreviewModel() {
    }

    static PreviewRenderFrame renderFrame(DungeonEditorPreview preview) {
        DungeonEditorPreview safePreview = preview == null ? DungeonEditorPreview.none() : preview;
        if (safePreview instanceof DungeonEditorPreview.ClusterBoundariesPreview boundaries) {
            List<PreviewBoundaryEdgeFrame> edges = new ArrayList<>();
            PreparedBoundaryKind kind = "DOOR".equalsIgnoreCase(boundaries.boundaryKind())
                    ? PreparedBoundaryKind.DOOR
                    : PreparedBoundaryKind.WALL;
            String label = boundaries.deleteMode() ? "Delete preview" : "Boundary preview";
            for (DungeonEdgeRef edge : boundaries.edges()) {
                if (edge != null && edge.from() != null && edge.to() != null) {
                    edges.add(new PreviewBoundaryEdgeFrame(
                            edge.from().q(), edge.from().r(), edge.to().q(), edge.to().r(),
                            edge.from().level(), kind, label, boundaries.clusterId()));
                }
            }
            return new PreviewRenderFrame(edges, List.of(), PreviewStairMarkerFrame.empty());
        }
        if (safePreview instanceof DungeonEditorPreview.StairCreatePreview stair && !stair.valid()) {
            List<PreviewStairCellFrame> cells = new ArrayList<>();
            addStairCell(cells, stair.anchor(), stairLabel(stair.shapeName()));
            if (!Objects.equals(stair.anchor(), stair.end())) {
                addStairCell(cells, stair.end(), "Treppen-Ziel");
            }
            DungeonCellRef anchor = stair.anchor();
            return new PreviewRenderFrame(
                    List.of(),
                    cells,
                    new PreviewStairMarkerFrame(anchor != null,
                            anchor == null ? 0 : anchor.q(),
                            anchor == null ? 0 : anchor.r(),
                            anchor == null ? 0 : anchor.level(), "z"));
        }
        return PreviewRenderFrame.empty();
    }

    static PreviewRenderDiffFrame diffFrame(DungeonEditorState state) {
        DungeonEditorState safeState = state == null ? DungeonEditorState.empty() : state;
        DungeonEditorSurface surface = safeState.selectedWindow();
        if (safeState.preview() instanceof DungeonEditorPreview.ClusterBoundariesPreview
                || surface == null || surface.previewMap() == null) {
            return PreviewRenderDiffFrame.empty();
        }
        DungeonEditorMapSnapshot committed = surface.map();
        DungeonEditorMapSnapshot preview = surface.previewMap();
        DiffResult<DungeonEditorMapSnapshot.Area> areas = diff(
                committed.areas(), preview.areas(), area -> area.kind() + ":" + area.id());
        DiffResult<DungeonEditorMapSnapshot.Boundary> boundaries = diff(
                committed.boundaries(), preview.boundaries(),
                boundary -> boundary.topologyRef() + ":" + boundary.id());
        DiffResult<DungeonEditorHandleSnapshot> handles = diff(
                committed.editorHandles(), preview.editorHandles(),
                handle -> handleKey(handle.ref()));
        DiffResult<DungeonEditorMapSnapshot.Feature> features = diff(
                committed.features(), preview.features(),
                feature -> feature.kind() + ":" + feature.topologyRef() + ":" + feature.id());
        return new PreviewRenderDiffFrame(
                map(areas.changed(), area -> areaFrame(area, false)),
                map(areas.removed(), area -> areaFrame(area, true)),
                map(boundaries.changed(), boundary -> boundaryFrame(boundary, false)),
                map(boundaries.removed(), boundary -> boundaryFrame(boundary, true)),
                map(handles.changed(), handle -> handleFrame(handle, false)),
                map(handles.removed(), handle -> handleFrame(handle, true)),
                map(features.changed(), feature -> featureFrame(feature, false)),
                map(features.removed(), feature -> featureFrame(feature, true)));
    }

    private static void addStairCell(List<PreviewStairCellFrame> cells, @Nullable DungeonCellRef cell, String label) {
        cells.add(new PreviewStairCellFrame(cell != null,
                cell == null ? 0 : cell.q(), cell == null ? 0 : cell.r(),
                cell == null ? 0 : cell.level(), label));
    }

    private static String stairLabel(String shape) {
        return switch (shape == null ? "" : shape.strip().toUpperCase(java.util.Locale.ROOT)) {
            case "SQUARE" -> "Treppen-Vorschau: Eckspirale";
            case "CIRCULAR" -> "Treppen-Vorschau: Rundspirale";
            default -> "Treppen-Vorschau: Gerade";
        };
    }

    private static String handleKey(DungeonEditorHandleRef ref) {
        DungeonEditorHandleRef safe = ref == null ? DungeonEditorHandleRef.empty() : ref;
        return safe.kind() + ":" + safe.topologyRef() + ":" + safe.ownerId() + ":"
                + safe.clusterId() + ":" + safe.corridorId() + ":" + safe.roomId() + ":" + safe.index();
    }

    private static PreviewAreaDiffFrame areaFrame(DungeonEditorMapSnapshot.Area area, boolean destructive) {
        return new PreviewAreaDiffFrame(area.kind(), area.id(), area.clusterId(), area.label(),
                area.cells(), area.topologyRef(), destructive);
    }

    private static PreviewBoundaryDiffFrame boundaryFrame(
            DungeonEditorMapSnapshot.Boundary boundary,
            boolean destructive
    ) {
        return new PreviewBoundaryDiffFrame(boundary.kind(), boundary.id(), boundary.label(),
                boundary.edge(), boundary.topologyRef(), destructive);
    }

    private static PreviewHandleDiffFrame handleFrame(DungeonEditorHandleSnapshot handle, boolean destructive) {
        return new PreviewHandleDiffFrame(handle.ref(), handle.label(), handle.cell(),
                handle.markerQ(), handle.markerR(), destructive);
    }

    private static PreviewFeatureDiffFrame featureFrame(
            DungeonEditorMapSnapshot.Feature feature,
            boolean destructive
    ) {
        return new PreviewFeatureDiffFrame(feature.kind(), feature.id(), feature.label(), feature.cells(),
                feature.description(), feature.destinationLabel(), feature.topologyRef(),
                feature.anchorEdge(), destructive);
    }

    private static <T, R> List<R> map(List<T> values, Function<T, R> mapper) {
        return values.stream().map(mapper).toList();
    }

    private static <T, K> DiffResult<T> diff(List<T> committed, List<T> preview, Function<T, K> key) {
        Map<K, T> remaining = new LinkedHashMap<>();
        for (T value : committed == null ? List.<T>of() : committed) {
            remaining.put(key.apply(value), value);
        }
        List<T> changed = new ArrayList<>();
        for (T value : preview == null ? List.<T>of() : preview) {
            T before = remaining.remove(key.apply(value));
            if (!value.equals(before)) {
                changed.add(value);
            }
        }
        return new DiffResult<>(List.copyOf(changed), List.copyOf(remaining.values()));
    }

    private record DiffResult<T>(List<T> changed, List<T> removed) {
    }
}

record PreviewRenderFrame(
        List<PreviewBoundaryEdgeFrame> boundaryEdges,
        List<PreviewStairCellFrame> stairCells,
        PreviewStairMarkerFrame stairMarker
) {
    PreviewRenderFrame {
        boundaryEdges = boundaryEdges == null ? List.of() : List.copyOf(boundaryEdges);
        stairCells = stairCells == null ? List.of() : List.copyOf(stairCells);
        stairMarker = stairMarker == null ? PreviewStairMarkerFrame.empty() : stairMarker;
    }

    static PreviewRenderFrame empty() {
        return new PreviewRenderFrame(List.of(), List.of(), PreviewStairMarkerFrame.empty());
    }
}

record PreviewBoundaryEdgeFrame(int fromQ, int fromR, int toQ, int toR, int level,
                                PreparedBoundaryKind boundaryKind, String label, long clusterId) {
    PreviewBoundaryEdgeFrame {
        boundaryKind = boundaryKind == null ? PreparedBoundaryKind.WALL : boundaryKind;
        label = label == null ? "" : label;
        clusterId = Math.max(0L, clusterId);
    }
}

record PreviewStairCellFrame(boolean present, int q, int r, int level, String label) {
    PreviewStairCellFrame {
        label = label == null ? "" : label;
    }
}

record PreviewStairMarkerFrame(boolean present, int q, int r, int level, String label) {
    PreviewStairMarkerFrame {
        label = label == null ? "" : label;
    }

    static PreviewStairMarkerFrame empty() {
        return new PreviewStairMarkerFrame(false, 0, 0, 0, "");
    }
}

record PreviewRenderDiffFrame(
        List<PreviewAreaDiffFrame> changedAreas,
        List<PreviewAreaDiffFrame> removedAreas,
        List<PreviewBoundaryDiffFrame> changedBoundaries,
        List<PreviewBoundaryDiffFrame> removedBoundaries,
        List<PreviewHandleDiffFrame> changedHandles,
        List<PreviewHandleDiffFrame> removedHandles,
        List<PreviewFeatureDiffFrame> changedFeatures,
        List<PreviewFeatureDiffFrame> removedFeatures
) {
    PreviewRenderDiffFrame {
        changedAreas = copy(changedAreas);
        removedAreas = copy(removedAreas);
        changedBoundaries = copy(changedBoundaries);
        removedBoundaries = copy(removedBoundaries);
        changedHandles = copy(changedHandles);
        removedHandles = copy(removedHandles);
        changedFeatures = copy(changedFeatures);
        removedFeatures = copy(removedFeatures);
    }

    static PreviewRenderDiffFrame empty() {
        return new PreviewRenderDiffFrame(List.of(), List.of(), List.of(), List.of(),
                List.of(), List.of(), List.of(), List.of());
    }

    boolean isEmpty() {
        return changedAreas.isEmpty() && removedAreas.isEmpty()
                && changedBoundaries.isEmpty() && removedBoundaries.isEmpty()
                && changedHandles.isEmpty() && removedHandles.isEmpty()
                && changedFeatures.isEmpty() && removedFeatures.isEmpty();
    }

    private static <T> List<T> copy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}

record PreviewAreaDiffFrame(String kind, long id, long clusterId, String label,
                            List<DungeonCellRef> cells, DungeonTopologyElementRef topologyRef,
                            boolean destructive) {
    PreviewAreaDiffFrame {
        cells = cells == null ? List.of() : List.copyOf(cells);
    }
}

record PreviewBoundaryDiffFrame(String kind, long id, String label, DungeonEdgeRef edge,
                                DungeonTopologyElementRef topologyRef, boolean destructive) {
}

record PreviewHandleDiffFrame(DungeonEditorHandleRef ref, String label, DungeonCellRef cell,
                              double markerQ, double markerR, boolean destructive) {
}

record PreviewFeatureDiffFrame(String kind, long id, String label, List<DungeonCellRef> cells,
                               String description, String destinationLabel,
                               DungeonTopologyElementRef topologyRef, DungeonEdgeRef anchorEdge,
                               boolean destructive) {
    PreviewFeatureDiffFrame {
        cells = cells == null ? List.of() : List.copyOf(cells);
    }
}
