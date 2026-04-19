package src.data.creatures.query;

import org.jspecify.annotations.Nullable;
import src.data.creatures.gateway.local.SqliteCreatureCatalogLocalGateway;
import src.data.creatures.mapper.CreatureCatalogPageMapper;
import src.data.creatures.mapper.CreatureDetailMapper;
import src.data.creatures.mapper.CreatureFilterValuesMapper;
import src.data.creatures.mapper.EncounterCandidateMapper;
import src.domain.creatures.api.CreatureCatalogPage;
import src.domain.creatures.api.CreatureDetail;
import src.domain.creatures.api.EncounterCandidate;
import src.domain.creatures.catalog.CreatureCatalogQueryPort;

import java.util.List;

public final class SqliteCreatureCatalogQueryAdapter implements CreatureCatalogQueryPort {

    private final SqliteCreatureCatalogLocalGateway gateway;

    public SqliteCreatureCatalogQueryAdapter() {
        this(new SqliteCreatureCatalogLocalGateway());
    }

    SqliteCreatureCatalogQueryAdapter(SqliteCreatureCatalogLocalGateway gateway) {
        this.gateway = requireGateway(gateway);
    }

    @Override
    public DistinctFilterValues loadFilterValues() {
        return CreatureFilterValuesMapper.toQueryValues(gateway.loadFilterValues());
    }

    @Override
    public CreatureCatalogPage searchCatalog(CatalogSearchSpec spec) {
        return CreatureCatalogPageMapper.toDomain(gateway.searchCatalog(spec));
    }

    @Override
    public @Nullable CreatureDetail loadCreatureDetail(long creatureId) {
        return CreatureDetailMapper.toDomain(gateway.loadCreatureDetail(creatureId));
    }

    @Override
    public List<EncounterCandidate> loadEncounterCandidates(EncounterCandidateSpec spec) {
        return gateway.loadEncounterCandidates(spec).stream()
                .map(EncounterCandidateMapper::toDomain)
                .toList();
    }

    private static SqliteCreatureCatalogLocalGateway requireGateway(SqliteCreatureCatalogLocalGateway gateway) {
        if (gateway == null) {
            throw new IllegalArgumentException("gateway");
        }
        return gateway;
    }
}
