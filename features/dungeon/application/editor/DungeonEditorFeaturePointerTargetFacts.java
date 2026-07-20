package features.dungeon.application.editor;

import static features.dungeon.api.editor.DungeonEditorPointerInput.ElementKind.FEATURE_MARKER;
import static features.dungeon.api.editor.DungeonEditorPointerInput.ElementKind.STAIR;
import static features.dungeon.api.editor.DungeonEditorPointerInput.ElementKind.TRANSITION;

import java.util.Locale;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.DungeonEditorMapSnapshot;

final class DungeonEditorFeaturePointerTargetFacts {
    private static final String FEATURE_OBJECT_KIND = "FEATURE_OBJECT";
    private static final String FEATURE_ENCOUNTER_KIND = "FEATURE_ENCOUNTER";
    private static final String FEATURE_POI_KIND = "FEATURE_POI";
    private static final String TRANSITION_KIND = "TRANSITION";

    private DungeonEditorFeaturePointerTargetFacts() {
    }

    static String cellKind(String kind) {
        return switch (kind == null ? "" : kind.trim().toUpperCase(Locale.ROOT)) {
            case "OBJECT" -> FEATURE_OBJECT_KIND;
            case "ENCOUNTER" -> FEATURE_ENCOUNTER_KIND;
            case "POI" -> FEATURE_POI_KIND;
            case TRANSITION_KIND -> TRANSITION_KIND;
            default -> "STAIR";
        };
    }

    static features.dungeon.api.editor.DungeonEditorPointerInput.ElementKind pointerElementKind(String cellKind) {
        return switch (cellKind) {
            case FEATURE_OBJECT_KIND, FEATURE_ENCOUNTER_KIND, FEATURE_POI_KIND -> FEATURE_MARKER;
            case TRANSITION_KIND -> TRANSITION;
            default -> STAIR;
        };
    }

    static boolean markerTargetFeature(DungeonEditorMapSnapshot.Feature feature) {
        String hitElementKind = cellKind(feature.kind());
        return TRANSITION_KIND.equals(hitElementKind) || FEATURE_MARKER == pointerElementKind(hitElementKind);
    }

    static int markerQ(DungeonEditorMapSnapshot.Feature feature) {
        return markerCoordinate(feature, true);
    }

    static int markerR(DungeonEditorMapSnapshot.Feature feature) {
        return markerCoordinate(feature, false);
    }

    private static int markerCoordinate(DungeonEditorMapSnapshot.Feature feature, boolean horizontal) {
        DungeonEdgeRef anchorEdge = feature.anchorEdge();
        if (anchorEdge != null && anchorEdge.from() != null && anchorEdge.to() != null) {
            double from = horizontal ? anchorEdge.from().q() : anchorEdge.from().r();
            double to = horizontal ? anchorEdge.to().q() : anchorEdge.to().r();
            return (int) Math.floor((from + to) / 2.0);
        }
        double total = 0.0;
        for (DungeonCellRef cell : feature.cells()) {
            total += (horizontal ? cell.q() : cell.r()) + 0.5;
        }
        return (int) Math.floor(total / Math.max(1, feature.cells().size()));
    }

    static int markerLevel(DungeonEditorMapSnapshot.Feature feature) {
        DungeonEdgeRef anchorEdge = feature.anchorEdge();
        if (anchorEdge != null && anchorEdge.from() != null) {
            return anchorEdge.from().level();
        }
        return feature.cells().isEmpty() ? 0 : feature.cells().getFirst().level();
    }
}
