package features.campaign.api;

import java.util.Objects;
import java.util.UUID;

/** Stable semantic Campaign identity, independent of its display name. */
public record CampaignId(UUID value) {

    public CampaignId {
        value = Objects.requireNonNull(value, "value");
    }
}
