package src.data.encountertable.query;

import java.util.List;
import java.util.Objects;
import java.util.ArrayList;
import platform.persistence.SqliteDatabase;
import src.data.encountertable.gateway.local.SqliteEncounterTableLocalGateway;
import src.data.encountertable.mapper.EncounterTableMapper;
import src.domain.encountertable.model.catalog.EncounterTableCandidateData;
import src.domain.encountertable.model.catalog.EncounterTableSummaryData;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalogPort;

public final class SqliteEncounterTableCatalogAdapter implements EncounterTableCatalogPort {

    private final SqliteEncounterTableLocalGateway gateway;

    public SqliteEncounterTableCatalogAdapter() {
        this(new SqliteEncounterTableLocalGateway());
    }

    public SqliteEncounterTableCatalogAdapter(SqliteDatabase database) {
        this(new SqliteEncounterTableLocalGateway(database));
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
