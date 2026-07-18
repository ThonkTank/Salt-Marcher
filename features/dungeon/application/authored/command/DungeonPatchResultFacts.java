package features.dungeon.application.authored.command;

import features.dungeon.domain.core.graph.DungeonTopologyRef;
import java.util.List;

/** Stable authored facts needed by post-commit publication. */
public record DungeonPatchResultFacts(List<DungeonTopologyRef> affectedTopologyRefs) {

    public DungeonPatchResultFacts {
        affectedTopologyRefs = affectedTopologyRefs == null
                ? List.of()
                : List.copyOf(affectedTopologyRefs);
    }

    @Override
    public List<DungeonTopologyRef> affectedTopologyRefs() {
        return List.copyOf(affectedTopologyRefs);
    }
}
