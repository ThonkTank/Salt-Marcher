package src.data.creatures.query;

import org.jspecify.annotations.Nullable;
import src.data.creatures.gateway.local.SqliteCreatureCatalogLocalGateway;
import src.data.creatures.mapper.CreatureCatalogQueryMappingFacade;
import src.domain.creatures.model.catalog.model.CreatureCatalogData.CatalogPageData;
import src.domain.creatures.model.catalog.model.CreatureCatalogData.CatalogSearchSpec;
import src.domain.creatures.model.catalog.model.CreatureCatalogData.CreatureProfile;
import src.domain.creatures.model.catalog.model.CreatureCatalogData.DistinctFilterValues;
import src.domain.creatures.model.catalog.model.CreatureCatalogData.EncounterCandidateProfile;
import src.domain.creatures.model.catalog.model.CreatureCatalogData.EncounterCandidateSpec;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;

import java.util.List;

public final class SqliteCreatureCatalogQueryAdapter implements CreatureCatalogPort {

    private final SqliteCreatureCatalogLocalGateway gateway;

    public SqliteCreatureCatalogQueryAdapter() {
        this(new SqliteCreatureCatalogLocalGateway());
    }

    SqliteCreatureCatalogQueryAdapter(SqliteCreatureCatalogLocalGateway gateway) {
        this.gateway = requireGateway(gateway);
    }

    @Override
    public DistinctFilterValues loadFilterValues() {
        return CreatureCatalogQueryMappingFacade.toQueryValues(gateway.loadFilterValues());
    }

    @Override
    public CatalogPageData searchCatalog(CatalogSearchSpec spec) {
        return CreatureCatalogQueryMappingFacade.toDomain(
                gateway.searchCatalog(CreatureCatalogQueryMappingFacade.toSearchCriteria(spec)));
    }

    @Override
    public @Nullable CreatureProfile loadCreatureDetail(long creatureId) {
        return CreatureCatalogQueryMappingFacade.toDomain(gateway.loadCreatureDetail(creatureId));
    }

    @Override
    public List<EncounterCandidateProfile> loadEncounterCandidates(EncounterCandidateSpec spec) {
        return CreatureCatalogQueryMappingFacade.toDomain(
                gateway.loadEncounterCandidates(CreatureCatalogQueryMappingFacade.toEncounterCriteria(spec)));
    }

    private static SqliteCreatureCatalogLocalGateway requireGateway(SqliteCreatureCatalogLocalGateway gateway) {
        if (gateway == null) {
            throw new IllegalArgumentException("gateway");
        }
        return gateway;
    }
}
