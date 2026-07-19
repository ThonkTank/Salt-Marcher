package features.dungeon.application.authored;

import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonWindow;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;

/** Complete marked command input or a typed non-mutating read rejection. */
public sealed interface DungeonCommandWorksetResult permits DungeonCommandWorksetResult.Complete,
        DungeonCommandWorksetResult.Rejected {

    record Complete(DungeonCommandWorkset workset) implements DungeonCommandWorksetResult {
        public Complete {
            workset = Objects.requireNonNull(workset, "workset");
        }
    }

    record Rejected(Reason reason, List<DungeonPatchEntityRef> affectedEntities)
            implements DungeonCommandWorksetResult {
        public Rejected {
            reason = Objects.requireNonNull(reason, "reason");
            List<DungeonPatchEntityRef> ordered = new ArrayList<>(new LinkedHashSet<>(
                    affectedEntities == null ? List.of() : affectedEntities));
            ordered.sort(DungeonWindow.ENTITY_ORDER);
            affectedEntities = List.copyOf(ordered);
        }
    }

    enum Reason {
        MAP_MISSING,
        STALE_REVISION,
        ENTITY_MISSING,
        MALFORMED_ENTITY,
        INCOMPLETE_ENTITY
    }
}
