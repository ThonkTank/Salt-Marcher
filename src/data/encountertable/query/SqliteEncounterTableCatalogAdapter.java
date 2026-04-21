package src.data.encountertable.query;

import java.util.List;
import java.util.Objects;
import src.data.encountertable.gateway.local.SqliteEncounterTableLocalGateway;
import src.data.encountertable.mapper.EncounterTableMapper;
import src.domain.encountertable.catalog.port.EncounterTableCatalog;
import src.domain.encountertable.catalog.value.EncounterTableCandidateData;
import src.domain.encountertable.catalog.value.EncounterTableSummaryData;

public final class SqliteEncounterTableCatalogAdapter implements EncounterTableCatalog {

    private final SqliteEncounterTableLocalGateway gateway;

    public SqliteEncounterTableCatalogAdapter() {
        this(new SqliteEncounterTableLocalGateway());
    }

    SqliteEncounterTableCatalogAdapter(SqliteEncounterTableLocalGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway, "gateway");
    }

    @Override
    public List<EncounterTableSummaryData> loadSummaries() {
        return gateway.loadSummaries().stream()
                .map(EncounterTableMapper::toDomain)
                .toList();
    }

    @Override
    public List<EncounterTableCandidateData> loadGenerationCandidates(List<Long> tableIds, int maximumXp) {
        return gateway.loadGenerationCandidates(tableIds, maximumXp).stream()
                .map(EncounterTableMapper::toDomain)
                .toList();
    }
}
