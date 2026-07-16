package features.dungeon.adapter.javafx.map;

import features.dungeon.api.DungeonEditorHandleKind;
import features.dungeon.api.DungeonFeatureKind;
import features.dungeon.adapter.javafx.map.DungeonMapRenderState.MarkerKind;

final class DungeonMapRenderMarkerKinds {

    private DungeonMapRenderMarkerKinds() {
    }

    static DungeonMapRenderState.MarkerKind handleMarkerKind(
            DungeonEditorHandleKind kind
    ) {
        if (kind == DungeonEditorHandleKind.DOOR) {
            return MarkerKind.DOOR;
        }
        if (kind == DungeonEditorHandleKind.STAIR_ANCHOR) {
            return MarkerKind.STAIR;
        }
        if (kind == DungeonEditorHandleKind.CLUSTER_WALL_RUN) {
            return MarkerKind.CLUSTER;
        }
        return MarkerKind.WAYPOINT;
    }

    static DungeonMapRenderState.MarkerKind featureMarkerKind(String kind) {
        return featureMarkerKind(DungeonMapRenderCells.featureKind(kind));
    }

    static DungeonMapRenderState.MarkerKind featureMarkerKind(
            DungeonFeatureKind kind
    ) {
        return switch (kind == null ? DungeonFeatureKind.STAIR : kind) {
            case TRANSITION -> MarkerKind.TRANSITION;
            case STAIR -> MarkerKind.STAIR;
            case OBJECT -> MarkerKind.FEATURE_OBJECT;
            case ENCOUNTER -> MarkerKind.FEATURE_ENCOUNTER;
            case POI -> MarkerKind.FEATURE_POI;
        };
    }

    static String featureMarkerLabel(String kind) {
        return featureMarkerLabel(DungeonMapRenderCells.featureKind(kind));
    }

    static String featureMarkerLabel(DungeonFeatureKind kind) {
        return switch (kind == null ? DungeonFeatureKind.STAIR : kind) {
            case TRANSITION -> "";
            case STAIR -> "z";
            case OBJECT -> "O";
            case ENCOUNTER -> "E";
            case POI -> "P";
        };
    }

    static double handleMarkerCoordinate(DungeonEditorHandleKind kind, int coordinate, double markerCoordinate) {
        if (kind == DungeonEditorHandleKind.CLUSTER_WALL_RUN || kind == DungeonEditorHandleKind.DOOR) {
            return markerCoordinate;
        }
        return kind == DungeonEditorHandleKind.CLUSTER_CORNER ? coordinate : coordinate + 0.5;
    }

    static String handleMarkerLabel(DungeonEditorHandleKind kind) {
        if (kind == DungeonEditorHandleKind.CLUSTER_CORNER) {
            return "+";
        }
        if (kind == DungeonEditorHandleKind.CLUSTER_WALL_RUN) {
            return "-";
        }
        if (kind == DungeonEditorHandleKind.DOOR) {
            return "";
        }
        if (kind == DungeonEditorHandleKind.STAIR_ANCHOR) {
            return "z";
        }
        if (kind == DungeonEditorHandleKind.CORRIDOR_ANCHOR) {
            return "o";
        }
        if (kind == DungeonEditorHandleKind.CORRIDOR_WAYPOINT) {
            return "•";
        }
        return "";
    }
}
