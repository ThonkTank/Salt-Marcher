package src.view.party.View;

import javafx.scene.control.Label;
import src.view.party.ViewModel.PartyToolbarSnapshot;

final class PartyToolbarStatusStyle {

    private PartyToolbarStatusStyle() {
    }

    static void apply(Label statusLabel, PartyToolbarSnapshot.Status status) {
        statusLabel.getStyleClass().removeAll("status-label-error", "status-label-success");
        statusLabel.getStyleClass().add(status.error()
                ? "status-label-error"
                : "status-label-success");
    }
}
