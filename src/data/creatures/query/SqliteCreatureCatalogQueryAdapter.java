package src.data.creatures.query;

import org.jspecify.annotations.Nullable;
import src.data.creatures.gateway.local.SqliteCreatureCatalogLocalGateway;
import src.data.creatures.mapper.CreatureCatalogQueryMappingFacade;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;

import java.util.List;

public final class SqliteCreatureCatalogQueryAdapter implements CreatureCatalogLookup {

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
    public CatalogPage searchCatalog(CatalogSearchSpec spec) {
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
