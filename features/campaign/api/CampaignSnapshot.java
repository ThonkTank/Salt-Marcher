package features.campaign.api;

import java.util.Objects;

/** Immutable installation-registry projection of one Campaign. */
public record CampaignSnapshot(CampaignId id, String name) {

    public CampaignSnapshot {
        id = Objects.requireNonNull(id, "id");
        name = Objects.requireNonNull(name, "name");
        if (name.isBlank()) {
            throw new IllegalArgumentException("Campaign name must not be blank");
        }
    }
}
