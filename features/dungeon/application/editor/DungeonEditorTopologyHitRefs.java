package features.dungeon.application.editor;

import features.dungeon.api.DungeonEditorTopologyElementRef;
import features.dungeon.api.DungeonTopologyElementRef;

public final class DungeonEditorTopologyHitRefs {
    private DungeonEditorTopologyHitRefs() {
    }

    public static String topologyKind(DungeonEditorTopologyElementRef ref) {
        return ref == null ? DungeonEditorMapHitRefs.EMPTY_KIND : ref.kind();
    }

    public static long topologyId(DungeonEditorTopologyElementRef ref) {
        return ref == null ? 0L : ref.id();
    }

    public static String topologyKind(DungeonTopologyElementRef ref) {
        return ref == null || ref.kind() == null ? DungeonEditorMapHitRefs.EMPTY_KIND : ref.kind().name();
    }

    public static long topologyId(DungeonTopologyElementRef ref) {
        return ref == null ? 0L : ref.id();
    }
}
