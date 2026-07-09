package src.features.dungeon.runtime;

import src.domain.dungeon.published.DungeonEditorMapHitRef;

final class DungeonEditorMapHitRefs {
    static final String EMPTY_KIND = "EMPTY";

    private DungeonEditorMapHitRefs() {
    }

    static DungeonEditorMapHitRef empty() {
        return new DungeonEditorMapHitRef("");
    }

    static String normalizeKind(String kind) {
        return kind == null || kind.isBlank() ? EMPTY_KIND : kind.strip();
    }

    static int sceneCoordinate(double coordinate) {
        return (int) Math.round(coordinate);
    }
}
