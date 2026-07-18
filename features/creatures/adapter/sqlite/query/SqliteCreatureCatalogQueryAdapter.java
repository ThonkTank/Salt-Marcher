package features.creatures.adapter.sqlite.query;

import org.jspecify.annotations.Nullable;
import platform.persistence.SqliteDatabase;
import features.creatures.adapter.sqlite.gateway.local.SqliteCreatureCatalogLocalGateway;
import features.creatures.adapter.sqlite.mapper.CreatureCatalogQueryMappingFacade;
import features.creatures.domain.catalog.CreatureCatalogData.CatalogPageData;
import features.creatures.domain.catalog.CreatureCatalogData.CatalogSearchSpec;
import features.creatures.domain.catalog.CreatureCatalogData.CreatureProfile;
import features.creatures.domain.catalog.CreatureCatalogData.DistinctFilterValues;
import features.creatures.domain.catalog.CreatureCatalogData.EncounterCandidateProfile;
import features.creatures.domain.catalog.CreatureCatalogData.EncounterCandidateSpec;
import features.creatures.domain.catalog.port.CreatureCatalogPort;

import java.util.List;

public final class SqliteCreatureCatalogQueryAdapter implements CreatureCatalogPort {

    private final SqliteCreatureCatalogLocalGateway gateway;

    public SqliteCreatureCatalogQueryAdapter() {
        this(new SqliteCreatureCatalogLocalGateway());
    }

    public SqliteCreatureCatalogQueryAdapter(SqliteDatabase database) {
        this(new SqliteCreatureCatalogLocalGateway(database));
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

    @Override
    public List<EncounterCandidateProfile> loadCreatureFacts(
            features.creatures.domain.catalog.CreatureCatalogData.CreatureFactsSpec spec
    ) {
        return CreatureCatalogQueryMappingFacade.toDomain(gateway.loadCreatureFacts(spec));
    }

    private static SqliteCreatureCatalogLocalGateway requireGateway(SqliteCreatureCatalogLocalGateway gateway) {
        if (gateway == null) {
            throw new IllegalArgumentException("gateway");
        }
        return gateway;
    }
}
