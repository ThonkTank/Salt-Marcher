package app;

import features.campaign.CampaignFeature;
import features.creatures.CreaturesServiceAssembly;
import features.items.ItemsServiceAssembly;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import platform.persistence.FeatureStoreHandle;
import platform.persistence.SqliteDatabase;

/** Complete installation-owned store manifest. */
final class InstallationStoreManifest {

    private InstallationStoreManifest() { }

    static Stores register(SqliteDatabase database) {
        return new Stores(
                database.featureStore(CampaignFeature.storeDefinition()),
                database.featureStore(CreaturesServiceAssembly.storeDefinition()),
                database.featureStore(ItemsServiceAssembly.storeDefinition()));
    }

    record Stores(
            FeatureStoreHandle campaignRegistry,
            FeatureStoreHandle creatures,
            FeatureStoreHandle items) {

        List<FeatureStoreHandle> all() {
            return List.of(campaignRegistry, creatures, items);
        }

        Set<String> owners() {
            return all().stream()
                    .map(FeatureStoreHandle::owner)
                    .collect(Collectors.toUnmodifiableSet());
        }
    }
}
