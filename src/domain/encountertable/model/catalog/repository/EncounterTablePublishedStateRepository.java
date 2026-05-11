package src.domain.encountertable.model.catalog.repository;

import src.domain.encountertable.published.EncounterTableCatalogResult;

public interface EncounterTablePublishedStateRepository {

    void publishCatalog(EncounterTableCatalogResult result);
}
