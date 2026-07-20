package features.dungeon.api.authored;

import features.dungeon.api.DungeonMapCatalogModel;
import features.dungeon.api.DungeonViewportRequest;
import features.dungeon.api.DungeonViewportSnapshot;
import java.util.concurrent.CompletionStage;

/** Public authored-map capability; repositories and aggregates remain internal. */
public interface DungeonAuthoredApi {
    DungeonMapCatalogModel mapCatalog();

    /** Returns the visible authored workset plus one prefetch ring. */
    CompletionStage<DungeonViewportSnapshot> viewport(DungeonViewportRequest request);
}
