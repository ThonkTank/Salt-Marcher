package features.dungeon.application.authored.command;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;

/** Stable authored facts needed by post-commit publication. */
public record DungeonPatchResultFacts(List<DungeonPatchEntityRef> affectedEntities) {

    public DungeonPatchResultFacts {
        List<DungeonPatchEntityRef> ordered = new ArrayList<>(new LinkedHashSet<>(
                affectedEntities == null ? List.of() : affectedEntities));
        ordered.sort(Comparator.comparing(DungeonPatchEntityRef::kind)
                .thenComparingLong(DungeonPatchEntityRef::id));
        affectedEntities = List.copyOf(ordered);
    }

    @Override
    public List<DungeonPatchEntityRef> affectedEntities() {
        return List.copyOf(affectedEntities);
    }
}
