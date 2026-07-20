package features.dungeon.adapter.javafx.editor;

import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.DungeonEditorHandleSnapshot;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.editor.DungeonEditorState;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/** Test-side comparison of committed and preview API maps; production rendering owns its own projection. */
record PreviewDiff(
        List<Area> changedAreas,
        List<Boundary> changedBoundaries,
        List<Handle> changedHandles,
        List<Feature> changedFeatures
) {
    static PreviewDiff from(DungeonEditorState snapshot) {
        if (snapshot == null || snapshot.selectedWindow() == null || snapshot.selectedWindow().previewMap() == null) {
            return new PreviewDiff(List.of(), List.of(), List.of(), List.of());
        }
        DungeonEditorMapSnapshot committed = snapshot.selectedWindow().map();
        DungeonEditorMapSnapshot preview = snapshot.selectedWindow().previewMap();
        return new PreviewDiff(
                map(changed(committed.areas(), preview.areas(), value -> value.kind() + ":" + value.id()),
                        value -> new Area(value.kind(), value.cells())),
                map(changed(committed.boundaries(), preview.boundaries(), value ->
                                value.topologyRef() + ":" + value.id()),
                        value -> new Boundary(value.kind(), value.edge())),
                map(changed(committed.editorHandles(), preview.editorHandles(), PreviewDiff::handleKey),
                        value -> new Handle(value.ref(), value.cell())),
                map(changed(committed.features(), preview.features(), value ->
                                value.kind() + ":" + value.topologyRef() + ":" + value.id()),
                        value -> new Feature(value.cells())));
    }

    boolean isEmpty() {
        return changedAreas.isEmpty() && changedBoundaries.isEmpty()
                && changedHandles.isEmpty() && changedFeatures.isEmpty();
    }

    private static String handleKey(DungeonEditorHandleSnapshot value) {
        var ref = value.ref();
        return ref.kind() + ":" + ref.topologyRef() + ":" + ref.ownerId() + ":"
                + ref.clusterId() + ":" + ref.corridorId() + ":" + ref.roomId() + ":" + ref.index();
    }

    private static <T, K> List<T> changed(List<T> committed, List<T> preview, Function<T, K> key) {
        Map<K, T> committedByKey = new LinkedHashMap<>();
        for (T value : committed == null ? List.<T>of() : committed) {
            committedByKey.put(key.apply(value), value);
        }
        List<T> changed = new ArrayList<>();
        for (T value : preview == null ? List.<T>of() : preview) {
            if (!value.equals(committedByKey.remove(key.apply(value)))) {
                changed.add(value);
            }
        }
        return List.copyOf(changed);
    }

    private static <T, R> List<R> map(List<T> values, Function<T, R> mapper) {
        return values.stream().map(mapper).toList();
    }

    record Area(String kind, List<DungeonCellRef> cells) {
    }

    record Boundary(String kind, DungeonEdgeRef edge) {
    }

    record Handle(features.dungeon.api.DungeonEditorHandleRef ref, DungeonCellRef cell) {
    }

    record Feature(List<DungeonCellRef> cells) {
    }
}
