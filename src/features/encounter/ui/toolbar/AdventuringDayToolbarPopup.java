package features.encounter.ui.toolbar;

import features.encounter.ui.toolbar.workflow.AdventuringDayToolbarController;
import features.party.api.PartyApi;
import javafx.geometry.Bounds;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;

import java.text.NumberFormat;
import java.util.Locale;

public final class AdventuringDayToolbarPopup {

    private static final NumberFormat INTEGER_FORMAT = NumberFormat.getIntegerInstance(Locale.GERMANY);

    private final Button triggerButton;
    private final Popup popup;
    private final AdventuringDayCalculatorPane calculatorPane = new AdventuringDayCalculatorPane();
    private final AdventuringDayToolbarController controller;

    public AdventuringDayToolbarPopup(AdventuringDayToolbarController controller) {
        this.controller = controller;
        triggerButton = new Button("Rastbudget ▾");
        triggerButton.getStyleClass().add("text-secondary");
        triggerButton.setTooltip(new Tooltip("Adventuring-Day-Rechner öffnen"));

        popup = new Popup();
        popup.setAutoHide(true);
        popup.setHideOnEscape(true);
        popup.getContent().add(buildPanel());

        triggerButton.setOnAction(event -> togglePopup());
        popup.setOnHidden(event -> triggerButton.requestFocus());
    }

    public Button getTriggerButton() {
        return triggerButton;
    }

    public void refreshActivePartyState() {
        loadActiveParty();
    }

    private VBox buildPanel() {
        Label headerLabel = new Label("ADVENTURING DAY");
        headerLabel.getStyleClass().add("large");
        Button closeButton = new Button("\u00D7");
        closeButton.getStyleClass().add("party-btn");
        closeButton.setAccessibleText("Adventuring-Day-Rechner schließen");
        closeButton.setOnAction(event -> popup.hide());
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox header = new HBox(6, headerLabel, spacer, closeButton);
        header.getStyleClass().add("party-header");
        header.setAlignment(Pos.CENTER_LEFT);

        ScrollPane scrollPane = new ScrollPane(calculatorPane);
        scrollPane.setFitToWidth(true);
        scrollPane.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER);
        scrollPane.setVbarPolicy(ScrollPane.ScrollBarPolicy.AS_NEEDED);
        scrollPane.setPrefViewportHeight(560);
        scrollPane.setMaxHeight(560);
        scrollPane.getStyleClass().add("adventuring-day-scroll");

        VBox panel = new VBox(header, scrollPane);
        panel.getStyleClass().addAll("party-panel", "adventuring-day-toolbar-popup");
        return panel;
    }

    private void togglePopup() {
        if (popup.isShowing()) {
            popup.hide();
            return;
        }
        refreshActivePartyState();
        triggerButton.applyCss();
        triggerButton.layout();
        Bounds screenBounds = triggerButton.localToScreen(triggerButton.getBoundsInLocal());
        if (screenBounds != null) {
            popup.show(
                    triggerButton.getScene().getWindow(),
                    screenBounds.getMaxX() - 420,
                    screenBounds.getMaxY() + 2);
        }
    }

    private void loadActiveParty() {
        controller.loadAdventuringDayParty(result -> {
            if (result == null || result.status() != PartyApi.ReadStatus.SUCCESS) {
                calculatorPane.markActivePartyRefreshFailed();
                triggerButton.setText("Rastbudget nicht verfügbar ▾");
                return;
            }
            PartyApi.AdventuringDayPartySummary summary = result.summary();
            calculatorPane.setActivePartySnapshot(summary == null ? java.util.List.of() : summary.activePartyLevels());
            updateTriggerText(summary);
        });
    }

    private void updateTriggerText(PartyApi.AdventuringDayPartySummary summary) {
        if (summary == null || summary.activePartyLevels() == null || summary.activePartyLevels().isEmpty()) {
            triggerButton.setText("Kein Rastbudget ▾");
            return;
        }
        triggerButton.setText("SR " + formatInt(summary.remainingToShortRest())
                + " · LR " + formatInt(summary.remainingToLongRest()) + " ▾");
    }

    private static String formatInt(int value) {
        return INTEGER_FORMAT.format(Math.max(0, value));
    }
}
