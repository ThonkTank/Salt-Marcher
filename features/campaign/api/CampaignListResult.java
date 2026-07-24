package features.campaign.api;

import java.util.List;
import java.util.Objects;

public record CampaignListResult(Status status, List<CampaignSnapshot> campaigns) {

    public enum Status {
        SUCCESS,
        STORAGE_ERROR
    }

    public CampaignListResult {
        status = Objects.requireNonNull(status, "status");
        campaigns = List.copyOf(Objects.requireNonNull(campaigns, "campaigns"));
        if (status == Status.STORAGE_ERROR && !campaigns.isEmpty()) {
            throw new IllegalArgumentException("Failed Campaign list must not expose a partial result");
        }
    }
}
