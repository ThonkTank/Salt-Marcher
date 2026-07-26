package features.campaign.api;

import java.util.Objects;
import java.util.Optional;

/** Registry commit result; it does not claim that a Campaign runtime is activated or usable. */
public record CampaignPointerCommitResult(
        Status status,
        Optional<CampaignActivation> activation) {

    public enum Status {
        COMMITTED,
        STALE_GENERATION,
        CAMPAIGN_NOT_FOUND,
        INVALID_NAME,
        INVALID_GENERATION,
        STORAGE_ERROR
    }

    public CampaignPointerCommitResult {
        status = Objects.requireNonNull(status, "status");
        activation = Objects.requireNonNull(activation, "activation");
        if (status == Status.STORAGE_ERROR && activation.isPresent()) {
            throw new IllegalArgumentException("Storage failure must not expose uncertain pointer state");
        }
        if ((status == Status.COMMITTED || status == Status.STALE_GENERATION)
                && activation.isEmpty()) {
            throw new IllegalArgumentException("Pointer commit outcome must carry durable state");
        }
    }
}
