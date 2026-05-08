package src.data.encountertable.query;

import java.util.List;
import java.util.Objects;
import java.util.ArrayList;
import src.data.encountertable.gateway.local.SqliteEncounterTableLocalGateway;
import src.data.encountertable.mapper.EncounterTableMapper;
import src.domain.encountertable.catalog.port.EncounterTableCatalog;
import src.domain.encountertable.catalog.value.EncounterTableCandidateData;
import src.domain.encountertable.published.EncounterTableSummary;

public final class SqliteEncounterTableCatalogAdapter implements EncounterTableCatalog {

    private final SqliteEncounterTableLocalGateway gateway;

    public SqliteEncounterTableCatalogAdapter() {
        this(new SqliteEncounterTableLocalGateway());
    }

    SqliteEncounterTableCatalogAdapter(SqliteEncounterTableLocalGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway, "gateway");
    }

    @Override
    public List<EncounterTableSummary> loadSummaries() {
        List<EncounterTableSummary> summaries = new ArrayList<>();
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
