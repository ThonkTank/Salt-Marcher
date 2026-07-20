package features.creatures.api;

import java.util.concurrent.CompletionStage;

/** Request/response catalog reads; callers own their own request ordering. */
public interface CreatureCatalogQueryApi {

    CompletionStage<CreatureCatalogPageResult> search(CreatureCatalogQuery query);

    CompletionStage<CreatureFilterOptionsResult> loadFilterOptions();
}
