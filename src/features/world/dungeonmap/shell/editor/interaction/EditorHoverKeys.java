package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.shell.interaction.DungeonHitSubject;
import features.world.dungeonmap.shell.interaction.DungeonSelectionKey;

import java.util.Objects;

final class EditorHoverKeys {

    private EditorHoverKeys() {
    }

    static DungeonSelectionKey ownerOnly(DungeonHitSubject subject) {
        DungeonHitSubject resolved = Objects.requireNonNull(subject, "subject");
        return new DungeonSelectionKey(resolved.kind(), resolved.targetKey(), "");
    }

    static DungeonSelectionKey partOnly(DungeonHitSubject subject) {
        DungeonHitSubject resolved = Objects.requireNonNull(subject, "subject");
        return new DungeonSelectionKey(resolved.kind(), "", resolved.partKey());
    }
}
