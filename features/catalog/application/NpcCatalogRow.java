package features.catalog.application;

import java.util.Objects;

public record NpcCatalogRow(long npcId, String displayName, long creatureStatblockId, String details) {
    public NpcCatalogRow {
        npcId = Math.max(0L, npcId);
        displayName = Objects.requireNonNullElse(displayName, "");
        creatureStatblockId = Math.max(0L, creatureStatblockId);
        details = Objects.requireNonNullElse(details, "");
    }
}
