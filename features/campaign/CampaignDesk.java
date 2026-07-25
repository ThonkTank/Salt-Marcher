package features.campaign;

import features.campaign.adapter.javafx.CampaignDeskView;
import features.campaign.api.CampaignSnapshot;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import javafx.scene.Parent;

/** Feature-root composition facade for the Campaign chooser. */
public final class CampaignDesk {

    public interface Actions {
        void create(String name);

        void select(CampaignSnapshot campaign);

        void recover();

        void reload();
    }

    private final CampaignDeskView view;

    private CampaignDesk(Actions actions) {
        Actions safeActions = Objects.requireNonNull(actions, "actions");
        view = new CampaignDeskView(new CampaignDeskView.Actions() {
            @Override
            public void create(String name) {
                safeActions.create(name);
            }

            @Override
            public void select(CampaignSnapshot campaign) {
                safeActions.select(campaign);
            }

            @Override
            public void recover() {
                safeActions.recover();
            }

            @Override
            public void reload() {
                safeActions.reload();
            }
        });
    }

    public static CampaignDesk compose(Actions actions) {
        return new CampaignDesk(actions);
    }

    public Parent root() {
        return view;
    }

    public void showLoading() {
        view.showLoading();
    }

    public void showCampaigns(
            List<CampaignSnapshot> available,
            Optional<CampaignSnapshot> current,
            String announcement
    ) {
        view.showCampaigns(available, current, announcement);
    }

    public void showSwitching(String campaignName) {
        view.showSwitching(campaignName);
    }

    public void showError(String message, boolean focusName) {
        view.showError(message, focusName);
    }

    public void showRecovery(
            String message,
            List<CampaignSnapshot> available,
            Optional<CampaignSnapshot> damagedCampaign
    ) {
        view.showRecovery(message, available, damagedCampaign);
    }

    public void confirmCreation() {
        view.confirmCreation();
    }
}
