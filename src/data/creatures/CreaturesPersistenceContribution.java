package src.data.creatures;

import shell.host.PersistenceContribution;
import shell.host.PersistenceRegistry;
import src.data.creatures.datasource.local.SqliteCreatureCatalogLocalDataSource;
import src.data.creatures.repository.SqliteCreatureCatalogRepository;
import src.domain.creatures.creaturesAPI;
import src.domain.creatures.repository.CreatureCatalogRepository;

/**
 * Root persistence entrypoint for the creatures feature.
 */
public final class CreaturesPersistenceContribution implements PersistenceContribution {

    public CreaturesPersistenceContribution() {
    }

    @Override
    public void register(PersistenceRegistry.Builder builder) {
        CreatureCatalogRepository repository =
                new SqliteCreatureCatalogRepository(new SqliteCreatureCatalogLocalDataSource());
        builder.register(
                CreatureCatalogRepository.class,
                repository);
        builder.register(
                creaturesAPI.Factory.class,
                () -> new creaturesAPI(repository));
    }
}
