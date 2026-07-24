package features.campaign.application;

import features.campaign.api.CampaignActivation;
import features.campaign.api.CampaignId;
import features.campaign.api.CampaignSnapshot;
import features.campaign.domain.CampaignName;
import java.util.List;
import java.util.Optional;

/** Installation-store port owned by Campaign registry application orchestration. */
public interface CampaignRegistryStore {

    List<CampaignSnapshot> list();

    Optional<CampaignSnapshot> read(CampaignId campaignId);

    CampaignActivation active();

    PointerCommitAttempt registerAndCommitActivePointer(
            CampaignId campaignId,
            CampaignName name,
            long expectedGeneration);

    PointerCommitAttempt commitActivePointer(CampaignId campaignId, long expectedGeneration);

    record PointerCommitAttempt(Status status, CampaignActivation activation) {

        public enum Status {
            COMMITTED,
            STALE_GENERATION,
            CAMPAIGN_NOT_FOUND
        }
    }
}
