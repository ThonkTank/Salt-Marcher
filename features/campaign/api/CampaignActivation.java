package features.campaign.api;

import java.util.Objects;
import java.util.Optional;

/** Durable active-Campaign pointer and its compare-and-set generation. */
public record CampaignActivation(Optional<CampaignSnapshot> campaign, long generation) {

    public CampaignActivation {
        campaign = Objects.requireNonNull(campaign, "campaign");
        if (generation < 0L) {
            throw new IllegalArgumentException("Activation generation must not be negative");
        }
        if (campaign.isEmpty() && generation != 0L) {
            throw new IllegalArgumentException("Missing active Campaign requires generation zero");
        }
        if (campaign.isPresent() && generation == 0L) {
            throw new IllegalArgumentException("Active Campaign requires a positive generation");
        }
    }

    public static CampaignActivation none() {
        return new CampaignActivation(Optional.empty(), 0L);
    }
}
