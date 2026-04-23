package src.view.dropdowns.adventuringday;

import javafx.beans.property.StringProperty;
import javafx.geometry.Insets;
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
import src.view.slotcontent.topbar.adventuringday.AdventuringDayCalculatorView;
import src.view.slotcontent.topbar.dropdown.DropdownPopupView;

public final class AdventuringDayTopBarView extends HBox {

    private static final double POPUP_WIDTH = 420.0;

    private final Button triggerButton = new Button("Rastbudget \u25be");
    private final Popup popup = new Popup();
    private final AdventuringDayCalculatorView calculatorPane = new AdventuringDayCalculatorView();
    private Runnable onOpen = () -> {};

    AdventuringDayTopBarView() {
        setSpacing(8);
        setPadding(new Insets(4, 0, 4, 8));
        configureTrigger();
        configurePopup();
        getChildren().add(triggerButton);
    }

    StringProperty triggerTextProperty() {
        return triggerButton.textProperty();
    }

    void showPanel(PanelContent content) {
        PanelContent safeContent = content == null ? PanelContent.loadingContent() : content;
        if (safeContent.error()) {
            calculatorPane.markActivePartyRefreshFailed();
            return;
        }
        calculatorPane.setActivePartySnapshot(safeContent.activePartyLevels());
    }

    void setCalculationProvider(AdventuringDayCalculatorView.CalculationProvider provider) {
        calculatorPane.setCalculationProvider(provider);
    }

    void onOpen(Runnable action) {
        onOpen = action == null ? () -> {} : action;
    }

    private void configureTrigger() {
        triggerButton.getStyleClass().add("text-secondary");
        triggerButton.setTooltip(new Tooltip("Adventuring-Day-Rechner \u00f6ffnen"));
        triggerButton.setOnAction(event -> togglePopup());
    }

    private void configurePopup() {
        VBox panel = buildPanel();
        panel.getStyleClass().addAll("party-panel", "adventuring-day-toolbar-popup");
        popup.setAutoHide(true);
        popup.setHideOnEscape(true);
        popup.getContent().add(panel);
        popup.setOnHidden(event -> triggerButton.requestFocus());
    }

    private VBox buildPanel() {
        Label headerLabel = new Label("ADVENTURING DAY");
        headerLabel.getStyleClass().add("title-large");
        Button closeButton = new Button("\u00d7");
        closeButton.getStyleClass().add("compact");
        closeButton.setAccessibleText("Adventuring-Day-Rechner schliessen");
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

        VBox body = new VBox(scrollPane);
        body.setPadding(new Insets(0, 12, 12, 12));
        return new VBox(header, body);
    }

    private void togglePopup() {
        DropdownPopupView.toggleTrailing(popup, triggerButton, POPUP_WIDTH, onOpen);
    }

    record PanelContent(
            boolean loading,
            boolean error,
            boolean empty,
            java.util.List<Integer> activePartyLevels
    ) {

        PanelContent {
            activePartyLevels = activePartyLevels == null ? java.util.List.of() : java.util.List.copyOf(activePartyLevels);
        }

        static PanelContent loadingContent() {
            return new PanelContent(true, false, false, java.util.List.of());
        }
    }
}
