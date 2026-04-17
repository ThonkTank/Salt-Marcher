package src.view.party.View;

import javafx.scene.control.Label;
import javafx.scene.control.ProgressBar;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;

record PartyToolbarPanelParts(
        VBox activeMembersBox,
        VBox reserveMembersBox,
        TextField reserveSearchField,
        Label summaryLabel,
        Label daySummaryLabel,
        Label statusLabel,
        ProgressBar budgetProgressBar,
        Label budgetPercentLabel
) {
}
