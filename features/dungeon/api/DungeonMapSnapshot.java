package features.dungeon.api;

import java.util.List;

public record DungeonMapSnapshot(
        DungeonTopologyKind topology,
        List<DungeonAreaSnapshot> areas,
        List<DungeonBoundarySnapshot> boundaries,
        List<DungeonFeatureSnapshot> features,
        List<DungeonEditorHandleSnapshot> editorHandles
) {

    public DungeonMapSnapshot {
        topology = defaultTopology(topology);
        areas = immutableAreas(areas);
        boundaries = immutableBoundaries(boundaries);
        features = immutableFeatures(features);
        editorHandles = immutableEditorHandles(editorHandles);
    }

    public static DungeonMapSnapshot empty() {
        return new DungeonMapSnapshot(DungeonTopologyKind.SQUARE, List.of(), List.of(), List.of(), List.of());
    }

    @Override
    public List<DungeonAreaSnapshot> areas() {
        return immutableAreas(areas);
    }

    @Override
    public List<DungeonBoundarySnapshot> boundaries() {
        return immutableBoundaries(boundaries);
    }

    @Override
    public List<DungeonFeatureSnapshot> features() {
        return immutableFeatures(features);
    }

    @Override
    public List<DungeonEditorHandleSnapshot> editorHandles() {
        return immutableEditorHandles(editorHandles);
    }

    private static DungeonTopologyKind defaultTopology(DungeonTopologyKind topology) {
        return topology == null ? DungeonTopologyKind.SQUARE : topology;
    }

    private static List<DungeonAreaSnapshot> immutableAreas(List<DungeonAreaSnapshot> areas) {
        return areas == null ? List.of() : List.copyOf(areas);
    }

    private static List<DungeonBoundarySnapshot> immutableBoundaries(List<DungeonBoundarySnapshot> boundaries) {
        return boundaries == null ? List.of() : List.copyOf(boundaries);
    }

    private static List<DungeonFeatureSnapshot> immutableFeatures(List<DungeonFeatureSnapshot> features) {
        return features == null ? List.of() : List.copyOf(features);
    }

    private static List<DungeonEditorHandleSnapshot> immutableEditorHandles(
            List<DungeonEditorHandleSnapshot> editorHandles
    ) {
        return editorHandles == null ? List.of() : List.copyOf(editorHandles);
    }
}
