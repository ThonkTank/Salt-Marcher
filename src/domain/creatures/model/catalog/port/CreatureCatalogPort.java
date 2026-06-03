package src.domain.creatures.model.catalog.port;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.creatures.model.catalog.CreatureCatalogData;
import src.domain.creatures.model.catalog.CreatureCatalogData.CreatureProfile;

public interface CreatureCatalogPort {

    CreatureCatalogData.DistinctFilterValues loadFilterValues();

    CreatureCatalogData.CatalogPageData searchCatalog(CreatureCatalogData.CatalogSearchSpec spec);

    @Nullable CreatureProfile loadCreatureDetail(long creatureId);

    List<CreatureCatalogData.EncounterCandidateProfile> loadEncounterCandidates(
            CreatureCatalogData.EncounterCandidateSpec spec);
}
