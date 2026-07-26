package features.campaign.api;

import java.util.Objects;
import java.util.Optional;

public record CampaignActiveResult(Status status, Optional<CampaignActivation> activation) {

    public enum Status {
        SUCCESS,
        STORAGE_ERROR
    }

    public CampaignActiveResult {
        status = Objects.requireNonNull(status, "status");
        activation = Objects.requireNonNull(activation, "activation");
        if ((status == Status.SUCCESS) != activation.isPresent()) {
            throw new IllegalArgumentException("Successful active-Campaign read must carry activation state");
        }
    }
}
