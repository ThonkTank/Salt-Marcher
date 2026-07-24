package features.campaign.api;

import java.util.Objects;
import java.util.Optional;

public record CampaignReadResult(Status status, Optional<CampaignSnapshot> campaign) {

    public enum Status {
        FOUND,
        NOT_FOUND,
        STORAGE_ERROR
    }

    public CampaignReadResult {
        status = Objects.requireNonNull(status, "status");
        campaign = Objects.requireNonNull(campaign, "campaign");
        if ((status == Status.FOUND) != campaign.isPresent()) {
            throw new IllegalArgumentException("Found Campaign result must carry exactly one Campaign");
        }
    }
}
