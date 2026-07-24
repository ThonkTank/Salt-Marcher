package features.campaign;

import features.campaign.adapter.sqlite.CampaignRegistrySchema;
import features.campaign.adapter.sqlite.SqliteCampaignRegistryStore;
import features.campaign.api.CampaignRegistryApi;
import features.campaign.application.CampaignRegistryApplicationService;
import java.util.Objects;
import platform.diagnostics.Diagnostics;
import platform.execution.ExecutionLane;
import platform.persistence.FeatureStoreDefinition;
import platform.persistence.FeatureStoreHandle;

/** Explicit composition entry point for the installation-owned Campaign registry. */
public final class CampaignFeature {

    private CampaignFeature() { }

    public static FeatureStoreDefinition storeDefinition() {
        return CampaignRegistrySchema.definition();
    }

    public static Component compose(
            Diagnostics diagnostics,
            ExecutionLane executionLane,
            FeatureStoreHandle store) {
        var persistence = new SqliteCampaignRegistryStore(store);
        var application = new CampaignRegistryApplicationService(
                diagnostics,
                executionLane,
                persistence);
        return new Component(application);
    }

    public record Component(CampaignRegistryApi registry) {

        public Component {
            registry = Objects.requireNonNull(registry, "registry");
        }
    }
}
