package src.domain.dungeon.published;

import java.util.List;

public record DungeonEditorPreviewDiff(
        List<DungeonEditorMapSnapshot.Area> changedAreas,
        List<DungeonEditorMapSnapshot.Area> removedAreas,
        List<DungeonEditorMapSnapshot.Boundary> changedBoundaries,
        List<DungeonEditorMapSnapshot.Boundary> removedBoundaries,
        List<DungeonEditorHandleSnapshot> changedHandles,
        List<DungeonEditorHandleSnapshot> removedHandles,
        List<DungeonEditorMapSnapshot.Feature> changedFeatures,
        List<DungeonEditorMapSnapshot.Feature> removedFeatures
) {

    private static final DungeonEditorPreviewDiff EMPTY = new DungeonEditorPreviewDiff(
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of());

    public DungeonEditorPreviewDiff {
        changedAreas = changedAreas == null ? List.of() : List.copyOf(changedAreas);
        removedAreas = removedAreas == null ? List.of() : List.copyOf(removedAreas);
        changedBoundaries = changedBoundaries == null ? List.of() : List.copyOf(changedBoundaries);
        removedBoundaries = removedBoundaries == null ? List.of() : List.copyOf(removedBoundaries);
        changedHandles = changedHandles == null ? List.of() : List.copyOf(changedHandles);
        removedHandles = removedHandles == null ? List.of() : List.copyOf(removedHandles);
        changedFeatures = changedFeatures == null ? List.of() : List.copyOf(changedFeatures);
        removedFeatures = removedFeatures == null ? List.of() : List.copyOf(removedFeatures);
    }

    public static DungeonEditorPreviewDiff empty() {
        return EMPTY;
    }
}
