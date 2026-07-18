package features.dungeon.application.authored.command;

import java.util.List;

/** Stable authored facts needed by post-commit publication. */
public record DungeonPatchResultFacts(List<DungeonPatchEntityRef> affectedEntities) {

    public DungeonPatchResultFacts {
        affectedEntities = affectedEntities == null
                ? List.of()
                : List.copyOf(affectedEntities);
    }

    @Override
    public List<DungeonPatchEntityRef> affectedEntities() {
        return List.copyOf(affectedEntities);
    }
}
