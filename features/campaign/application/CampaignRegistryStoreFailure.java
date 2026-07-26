package features.campaign.application;

/** Mechanism-neutral failure reported by the Campaign registry persistence port. */
public final class CampaignRegistryStoreFailure extends RuntimeException {

    public CampaignRegistryStoreFailure(Throwable cause) {
        super("Campaign registry persistence failed", cause);
    }
}
