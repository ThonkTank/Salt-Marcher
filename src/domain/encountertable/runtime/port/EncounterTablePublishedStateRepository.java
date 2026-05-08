package src.domain.encountertable.runtime.port;

import src.domain.encountertable.published.EncounterTableCatalogResult;

public interface EncounterTablePublishedStateRepository {

    void publishCatalog(EncounterTableCatalogResult result);
}
