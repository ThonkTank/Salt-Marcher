package src.data.creatures.query;

import org.jspecify.annotations.Nullable;
import src.data.creatures.gateway.local.SqliteCreatureCatalogLocalGateway;
import src.data.creatures.mapper.CreatureCatalogQueryMappingFacade;
import src.domain.creatures.published.CreatureCatalogPage;
import src.domain.creatures.published.CreatureDetail;
import src.domain.creatures.published.EncounterCandidate;
import src.domain.creatures.catalog.repository.CreatureCatalogRepository;

import java.util.List;

public final class SqliteCreatureCatalogQueryAdapter implements CreatureCatalogRepository {

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
    public CreatureCatalogPage searchCatalog(CatalogSearchSpec spec) {
        return CreatureCatalogQueryMappingFacade.toDomain(gateway.searchCatalog(spec));
    }

    @Override
    public @Nullable CreatureDetail loadCreatureDetail(long creatureId) {
        return CreatureCatalogQueryMappingFacade.toDomain(gateway.loadCreatureDetail(creatureId));
    }

    @Override
    public List<EncounterCandidate> loadEncounterCandidates(EncounterCandidateSpec spec) {
        return CreatureCatalogQueryMappingFacade.toDomain(gateway.loadEncounterCandidates(spec));
    }

    private static SqliteCreatureCatalogLocalGateway requireGateway(SqliteCreatureCatalogLocalGateway gateway) {
        if (gateway == null) {
            throw new IllegalArgumentException("gateway");
        }
        return gateway;
    }
}
