package features.dungeon.application.authored.port;

import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/** Complete exact-identity closure or one typed rejection; no partial payload is returned. */
public sealed interface DungeonIdentityClosureResult permits DungeonIdentityClosureResult.Complete,
        DungeonIdentityClosureResult.Rejected {

    record Complete(DungeonMapHeader mapHeader, List<DungeonEntitySnapshot> entities)
            implements DungeonIdentityClosureResult {
        public Complete {
            mapHeader = Objects.requireNonNull(mapHeader, "mapHeader");
            List<DungeonEntitySnapshot> ordered = new ArrayList<>(entities == null ? List.of() : entities);
            ordered.sort((left, right) -> DungeonWindow.ENTITY_ORDER.compare(left.ref(), right.ref()));
            entities = List.copyOf(ordered);
        }
    }

    record Rejected(Reason reason, List<DungeonPatchEntityRef> affectedEntities)
            implements DungeonIdentityClosureResult {
        public Rejected {
            reason = Objects.requireNonNull(reason, "reason");
            List<DungeonPatchEntityRef> ordered = new ArrayList<>(
                    affectedEntities == null ? List.of() : affectedEntities);
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
