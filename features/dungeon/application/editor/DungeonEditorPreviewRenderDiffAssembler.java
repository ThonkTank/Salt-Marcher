package features.dungeon.application.editor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import features.dungeon.api.DungeonEditorHandleRef;
import features.dungeon.api.DungeonEditorHandleSnapshot;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonEditorMapSurfaceSnapshot;
import features.dungeon.api.DungeonEditorPreview;
import features.dungeon.api.DungeonEditorSurface;
import features.dungeon.api.DungeonTopologyElementRef;

final class DungeonEditorPreviewRenderDiffAssembler {
    private DungeonEditorPreviewRenderDiffAssembler() {
    }

    static DungeonEditorPreparedFrameFacts.PreviewRenderDiffFrame from(
            DungeonEditorMapSurfaceSnapshot snapshot
    ) {
        DungeonEditorMapSurfaceSnapshot safeSnapshot = snapshot == null
                ? DungeonEditorMapSurfaceSnapshot.empty()
                : snapshot;
        DungeonEditorSurface surface = safeSnapshot.surface();
        if (!renderStructuredPreviewDiff(safeSnapshot.preview())
                || surface == null
                || surface.previewMap() == null) {
            return DungeonEditorPreparedFrameFacts.PreviewRenderDiffFrame.empty();
        }
        DungeonEditorMapSnapshot committedMap = surface.map();
        DungeonEditorMapSnapshot previewMap = surface.previewMap();
        DiffResult<DungeonEditorMapSnapshot.Area> areaDiff =
                diff(committedMap.areas(), previewMap.areas(), DungeonEditorPreviewRenderDiffAssembler::areaKey);
        DiffResult<DungeonEditorMapSnapshot.Boundary> boundaryDiff =
                diff(committedMap.boundaries(), previewMap.boundaries(), DungeonEditorPreviewRenderDiffAssembler::boundaryKey);
        DiffResult<DungeonEditorHandleSnapshot> handleDiff =
                diff(committedMap.editorHandles(), previewMap.editorHandles(), DungeonEditorPreviewRenderDiffAssembler::handleKey);
        DiffResult<DungeonEditorMapSnapshot.Feature> featureDiff =
                diff(committedMap.features(), previewMap.features(), DungeonEditorPreviewRenderDiffAssembler::featureKey);
        DungeonEditorPreparedFrameFacts.PreviewRenderDiffFrame frame =
                new DungeonEditorPreparedFrameFacts.PreviewRenderDiffFrame(
                        frames(areaDiff.changed(), area -> new DungeonEditorPreparedFrameFacts.PreviewAreaDiffFrame(
                                area.kind(),
                                area.id(),
                                area.clusterId(),
                                area.label(),
                                area.cells(),
                                area.topologyRef(),
                                false)),
                        frames(areaDiff.removed(), area -> new DungeonEditorPreparedFrameFacts.PreviewAreaDiffFrame(
                                area.kind(),
                                area.id(),
                                area.clusterId(),
                                area.label(),
                                area.cells(),
                                area.topologyRef(),
                                true)),
                        frames(boundaryDiff.changed(), boundary -> new DungeonEditorPreparedFrameFacts.PreviewBoundaryDiffFrame(
                                boundary.kind(),
                                boundary.id(),
                                boundary.label(),
                                boundary.edge(),
                                boundary.topologyRef(),
                                false)),
                        frames(boundaryDiff.removed(), boundary -> new DungeonEditorPreparedFrameFacts.PreviewBoundaryDiffFrame(
                                boundary.kind(),
                                boundary.id(),
                                boundary.label(),
                                boundary.edge(),
                                boundary.topologyRef(),
                                true)),
                        frames(handleDiff.changed(), handle -> new DungeonEditorPreparedFrameFacts.PreviewHandleDiffFrame(
                                handle.ref(),
                                handle.label(),
                                handle.cell(),
                                handle.markerQ(),
                                handle.markerR(),
                                false)),
                        frames(handleDiff.removed(), handle -> new DungeonEditorPreparedFrameFacts.PreviewHandleDiffFrame(
                                handle.ref(),
                                handle.label(),
                                handle.cell(),
                                handle.markerQ(),
                                handle.markerR(),
                                true)),
                        frames(featureDiff.changed(), feature -> new DungeonEditorPreparedFrameFacts.PreviewFeatureDiffFrame(
                                feature.kind(),
                                feature.id(),
                                feature.label(),
                                feature.cells(),
                                feature.description(),
                                feature.destinationLabel(),
                                feature.topologyRef(),
                                feature.anchorEdge(),
                                false)),
                        frames(featureDiff.removed(), feature -> new DungeonEditorPreparedFrameFacts.PreviewFeatureDiffFrame(
                                feature.kind(),
                                feature.id(),
                                feature.label(),
                                feature.cells(),
                                feature.description(),
                                feature.destinationLabel(),
                                feature.topologyRef(),
                                feature.anchorEdge(),
                                true)));
        return frame.isEmpty() ? DungeonEditorPreparedFrameFacts.PreviewRenderDiffFrame.empty() : frame;
    }

    private static boolean renderStructuredPreviewDiff(DungeonEditorPreview preview) {
        return !(preview instanceof DungeonEditorPreview.ClusterBoundariesPreview);
    }

    private static <T, R> List<R> frames(
            List<T> values,
            Function<T, R> frame
    ) {
        List<R> result = new ArrayList<>();
        for (T value : values == null ? List.<T>of() : values) {
            result.add(frame.apply(value));
        }
        return List.copyOf(result);
    }

    private static <T, K> DiffResult<T> diff(
            List<T> committedValues,
            List<T> previewValues,
            Function<T, K> key
    ) {
        Map<K, T> committedByKey = index(committedValues, key);
        List<T> changed = new ArrayList<>();
        for (T previewValue : previewValues == null ? List.<T>of() : previewValues) {
            T committedValue = committedByKey.remove(key.apply(previewValue));
            if (!previewValue.equals(committedValue)) {
                changed.add(previewValue);
            }
        }
        return new DiffResult<>(changed, List.copyOf(committedByKey.values()));
    }

    private static <T, K> Map<K, T> index(List<T> values, Function<T, K> key) {
        Map<K, T> result = new LinkedHashMap<>();
        for (T value : values == null ? List.<T>of() : values) {
            result.put(key.apply(value), value);
        }
        return result;
    }

    private static AreaKey areaKey(DungeonEditorMapSnapshot.Area area) {
        return new AreaKey(area.kind(), area.id());
    }

    private static BoundaryKey boundaryKey(DungeonEditorMapSnapshot.Boundary boundary) {
        var ref = boundary.topologyRef();
        return new BoundaryKey(ref.kind(), ref.id(), boundary.id());
    }

    private static HandleKey handleKey(DungeonEditorHandleSnapshot handle) {
        DungeonEditorHandleRef handleRef = handle.ref();
        DungeonTopologyElementRef topologyRef = handleRef.topologyRef();
        return new HandleKey(
                handleRef.kind().name(),
                topologyRef.kind().name(),
                topologyRef.id(),
                handleRef.ownerId(),
                handleRef.clusterId(),
                handleRef.corridorId(),
                handleRef.roomId(),
                handleRef.index());
    }

    private static FeatureKey featureKey(DungeonEditorMapSnapshot.Feature feature) {
        var ref = feature.topologyRef();
        return new FeatureKey(feature.kind(), ref.kind(), ref.id(), feature.id());
    }

    private record DiffResult<T>(List<T> changed, List<T> removed) {
    }

    private record AreaKey(String kind, long id) {
    }

    private record BoundaryKey(
            features.dungeon.api.DungeonTopologyElementKind topologyKind,
            long topologyId,
            long boundaryId
    ) {
    }

    private record HandleKey(
            String kind,
            String topologyKind,
            long topologyId,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int index
    ) {
    }

    private record FeatureKey(
            String featureKind,
            features.dungeon.api.DungeonTopologyElementKind topologyKind,
            long topologyId,
            long featureId
    ) {
    }
}
