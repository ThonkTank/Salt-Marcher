package features.campaign.domain;

import java.util.Objects;

/** The sole GM-authored field required to create a Campaign. */
public record CampaignName(String value) {

    public CampaignName {
        value = Objects.requireNonNull(value, "value").strip();
        if (value.isEmpty()) {
            throw new IllegalArgumentException("Campaign name must not be blank");
        }
    }
}
