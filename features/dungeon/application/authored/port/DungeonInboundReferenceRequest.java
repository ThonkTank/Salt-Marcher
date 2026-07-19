package features.dungeon.application.authored.port;

import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;

/** Bounded reverse-reference discovery for exact stable identities at one revision. */
public record DungeonInboundReferenceRequest(
        DungeonMapIdentity mapId,
        long expectedMapRevision,
        List<DungeonPatchEntityRef> targetRefs
) {
    public DungeonInboundReferenceRequest {
        mapId = Objects.requireNonNull(mapId, "mapId");
        if (expectedMapRevision < 1L) {
            throw new IllegalArgumentException("expectedMapRevision must be positive");
        }
        List<DungeonPatchEntityRef> ordered = new ArrayList<>(new LinkedHashSet<>(
                targetRefs == null ? List.of() : targetRefs));
        ordered.sort(DungeonWindow.ENTITY_ORDER);
        targetRefs = List.copyOf(ordered);
    }
}
