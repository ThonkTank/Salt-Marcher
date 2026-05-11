package src.domain.creatures.model.catalog.repository;

import src.domain.creatures.published.CreatureCatalogPageResult;
import src.domain.creatures.published.CreatureDetailResult;
import src.domain.creatures.published.CreatureFilterOptionsResult;

public interface CreaturesPublishedStateRepository {

    void publishFilterOptions(CreatureFilterOptionsResult result);

    void publishCatalogPage(CreatureCatalogPageResult result);

    void publishCreatureDetail(CreatureDetailResult result);
}
