package features.dungeon.application.authored.port;

import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;

/** Exact stable identities required by one command at one committed map revision. */
public record DungeonIdentityClosureRequest(
        DungeonMapIdentity mapId,
        long expectedMapRevision,
        List<DungeonPatchEntityRef> entityRefs
) {
    public DungeonIdentityClosureRequest {
        mapId = Objects.requireNonNull(mapId, "mapId");
        if (expectedMapRevision < 1L) {
            throw new IllegalArgumentException("expectedMapRevision must be positive");
        }
        List<DungeonPatchEntityRef> ordered = new ArrayList<>(new LinkedHashSet<>(
                entityRefs == null ? List.of() : entityRefs));
        ordered.sort(DungeonWindow.ENTITY_ORDER);
        entityRefs = List.copyOf(ordered);
    }
}
