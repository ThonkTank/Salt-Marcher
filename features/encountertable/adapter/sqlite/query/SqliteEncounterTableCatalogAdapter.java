package features.encountertable.adapter.sqlite.query;

import features.encountertable.adapter.sqlite.gateway.local.SqliteEncounterTableLocalGateway;
import features.encountertable.adapter.sqlite.mapper.EncounterTableMapper;
import features.encountertable.domain.catalog.EncounterTableCandidateData;
import features.encountertable.domain.catalog.EncounterTableSummaryData;
import features.encountertable.domain.catalog.port.EncounterTableCatalogPort;

import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class SqliteEncounterTableCatalogAdapter implements EncounterTableCatalogPort {

    private final SqliteEncounterTableLocalGateway gateway;

    public static FeatureStoreDefinition storeDefinition() {
        return SqliteEncounterTableLocalGateway.storeDefinition();
    }

    public SqliteEncounterTableCatalogAdapter(FeatureStoreHandle store) {
        this(new SqliteEncounterTableLocalGateway(store));
    }

    SqliteEncounterTableCatalogAdapter(SqliteEncounterTableLocalGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway, "gateway");
    }

    @Override
    public List<EncounterTableSummaryData> loadSummaries() {
        List<EncounterTableSummaryData> summaries = new ArrayList<>();
        gateway.loadSummaries().forEach(record -> summaries.add(EncounterTableMapper.toDomain(record)));
        return List.copyOf(summaries);
    }

    @Override
    public List<EncounterTableCandidateData> loadGenerationCandidates(List<Long> tableIds, int maximumXp) {
        List<EncounterTableCandidateData> candidates = new ArrayList<>();
        gateway.loadGenerationCandidates(tableIds, maximumXp)
                .forEach(record -> candidates.add(EncounterTableMapper.toDomain(record)));
        return List.copyOf(candidates);
    }
}
