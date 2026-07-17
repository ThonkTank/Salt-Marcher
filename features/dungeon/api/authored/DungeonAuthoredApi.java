package features.dungeon.api.authored;

import features.dungeon.api.DungeonAuthoredMutationModel;
import features.dungeon.api.DungeonAuthoredReadModel;
import features.dungeon.api.DungeonMapCatalogModel;
import features.dungeon.api.DungeonViewportRequest;
import features.dungeon.api.DungeonViewportSnapshot;

/** Public authored-map capability; repositories and aggregates remain internal. */
public interface DungeonAuthoredApi {
    DungeonAuthoredReadModel authoredMaps();

    DungeonAuthoredMutationModel authoredMutations();

    DungeonMapCatalogModel mapCatalog();

    /** Returns the visible authored workset plus one prefetch ring. */
    DungeonViewportSnapshot viewport(DungeonViewportRequest request);
}
