package src.domain.dungeon;

import java.util.List;

record DungeonEditorPreviewFactDiffProjectionServiceAssembly<T>(List<T> changed, List<T> removed) {

    DungeonEditorPreviewFactDiffProjectionServiceAssembly {
        changed = changed == null ? List.of() : List.copyOf(changed);
        removed = removed == null ? List.of() : List.copyOf(removed);
    }
}
