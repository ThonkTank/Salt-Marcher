package features.creatures.domain.catalog.port;

import java.util.List;
import org.jspecify.annotations.Nullable;
import features.creatures.domain.catalog.CreatureCatalogData;
import features.creatures.domain.catalog.CreatureCatalogData.CreatureProfile;

public interface CreatureCatalogPort {

    CreatureCatalogData.DistinctFilterValues loadFilterValues();

    CreatureCatalogData.CatalogPageData searchCatalog(CreatureCatalogData.CatalogSearchSpec spec);

    @Nullable CreatureProfile loadCreatureDetail(long creatureId);

    List<CreatureCatalogData.EncounterCandidateProfile> loadEncounterCandidates(
            CreatureCatalogData.EncounterCandidateSpec spec);

    List<CreatureCatalogData.EncounterCandidateProfile> loadCreatureFacts(
            CreatureCatalogData.CreatureFactsSpec spec);
}
