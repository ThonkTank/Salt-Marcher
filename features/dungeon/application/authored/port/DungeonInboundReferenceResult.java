package features.dungeon.application.authored.port;

import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;

/** Complete bounded inbound identities or the same typed source rejection as closure. */
public sealed interface DungeonInboundReferenceResult permits DungeonInboundReferenceResult.Complete,
        DungeonInboundReferenceResult.Rejected {

    record Complete(DungeonMapHeader mapHeader, List<DungeonPatchEntityRef> inboundRefs)
            implements DungeonInboundReferenceResult {
        public Complete {
            mapHeader = Objects.requireNonNull(mapHeader, "mapHeader");
            List<DungeonPatchEntityRef> ordered = new ArrayList<>(new LinkedHashSet<>(
                    inboundRefs == null ? List.of() : inboundRefs));
            ordered.sort(DungeonWindow.ENTITY_ORDER);
            inboundRefs = List.copyOf(ordered);
        }
    }

    record Rejected(DungeonIdentityClosureResult.Reason reason, List<DungeonPatchEntityRef> affectedEntities)
            implements DungeonInboundReferenceResult {
        public Rejected {
            reason = Objects.requireNonNull(reason, "reason");
            List<DungeonPatchEntityRef> ordered = new ArrayList<>(new LinkedHashSet<>(
                    affectedEntities == null ? List.of() : affectedEntities));
            ordered.sort(DungeonWindow.ENTITY_ORDER);
            affectedEntities = List.copyOf(ordered);
        }
    }
}
