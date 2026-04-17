package src.data.creatures.repository;

import org.jspecify.annotations.Nullable;
import src.data.creatures.datasource.local.SqliteCreatureCatalogLocalDataSource;
import src.data.creatures.mapper.CreatureCatalogMapper;
import src.domain.creatures.api.CreatureCatalogPage;
import src.domain.creatures.api.CreatureDetail;
import src.domain.creatures.api.EncounterCandidate;
import src.domain.creatures.repository.CreatureCatalogRepository;

import java.util.List;
import java.util.Objects;

public final class SqliteCreatureCatalogRepository implements CreatureCatalogRepository {

    private final SqliteCreatureCatalogLocalDataSource dataSource;

    public SqliteCreatureCatalogRepository(SqliteCreatureCatalogLocalDataSource dataSource) {
        this.dataSource = Objects.requireNonNull(dataSource, "dataSource");
    }

    @Override
    public DistinctFilterValues loadFilterValues() {
        return dataSource.loadFilterValues();
    }

    @Override
    public CreatureCatalogPage searchCatalog(CatalogSearchSpec spec) {
        return CreatureCatalogMapper.toDomain(dataSource.searchCatalog(spec));
    }

    @Override
    public @Nullable CreatureDetail loadCreatureDetail(long creatureId) {
        return dataSource.loadCreatureDetail(creatureId);
    }

    @Override
    public List<EncounterCandidate> loadEncounterCandidates(EncounterCandidateSpec spec) {
        return dataSource.loadEncounterCandidates(spec).stream()
                .map(CreatureCatalogMapper::toDomain)
                .toList();
    }
}
