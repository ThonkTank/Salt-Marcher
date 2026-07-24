package features.campaign.api;

import java.util.concurrent.CompletionStage;

/** Non-blocking installation-owned Campaign registry capability. */
public interface CampaignRegistryApi {

    CompletionStage<CampaignPointerCommitResult> registerAndCommitActivePointer(
            CampaignId campaignId,
            String name,
            long expectedGeneration);

    CompletionStage<CampaignListResult> list();

    CompletionStage<CampaignReadResult> read(CampaignId campaignId);

    CompletionStage<CampaignActiveResult> active();

    CompletionStage<CampaignPointerCommitResult> commitActivePointer(
            CampaignId campaignId,
            long expectedGeneration);
}
