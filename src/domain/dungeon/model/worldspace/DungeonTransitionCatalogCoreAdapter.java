package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.structure.transition.Transition;
import src.domain.dungeon.model.core.structure.transition.TransitionCatalog;

final class DungeonTransitionCatalogCoreAdapter {

    private DungeonTransitionCatalogCoreAdapter() {
    }

    static TransitionCatalog toCoreCatalog(List<DungeonTransition> transitions) {
        List<Transition> result = new ArrayList<>();
        for (DungeonTransition transition : transitions == null ? List.<DungeonTransition>of() : transitions) {
            if (transition != null) {
                result.add(transition.coreTransition());
            }
        }
        return new TransitionCatalog(result);
    }

    static List<DungeonTransition> fromCoreCatalog(TransitionCatalog catalog) {
        List<DungeonTransition> result = new ArrayList<>();
        for (Transition transition : catalog == null ? List.<Transition>of() : catalog.transitions()) {
            result.add(DungeonTransition.fromCore(transition));
        }
        return List.copyOf(result);
    }
}
