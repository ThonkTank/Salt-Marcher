package src.view.dropdowns.adventuringday;

import javafx.beans.property.StringProperty;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.stage.Popup;
import src.view.slotcontent.topbar.dropdown.DropdownPopupView;

public final class AdventuringDayTopBarView extends HBox {

    private static final double POPUP_WIDTH = 340.0;

    private final Button triggerButton = new Button("Rastbudget \u25be");
    private final Popup popup = new Popup();
    private final Label messageLabel = new Label();
    private final Label shortRestValue = new Label();
    private final Label longRestValue = new Label();
    private final Label budgetValue = new Label();
    private final GridPane summaryGrid = new GridPane();
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
        shortRestValue.setText(safeContent.shortRestText());
        longRestValue.setText(safeContent.longRestText());
        budgetValue.setText(safeContent.budgetText());
        boolean showSummary = !safeContent.loading() && !safeContent.error() && !safeContent.empty();
        summaryGrid.setVisible(showSummary);
        summaryGrid.setManaged(showSummary);
        messageLabel.setText(safeContent.message());
        messageLabel.setVisible(!safeContent.message().isBlank());
        messageLabel.setManaged(messageLabel.isVisible());
        messageLabel.getStyleClass().removeAll("text-muted", "text-warning");
        messageLabel.getStyleClass().add(safeContent.error() ? "text-warning" : "text-muted");
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
        panel.getStyleClass().add("party-panel");
        popup.setAutoHide(true);
        popup.setHideOnEscape(true);
        popup.getContent().add(panel);
        popup.setOnHidden(event -> triggerButton.requestFocus());
    }

    private VBox buildPanel() {
        Label headerLabel = new Label("ADVENTURING DAY");
        headerLabel.getStyleClass().add("title-large");
        Button closeButton = new Button("\u00d7");
        closeButton.getStyleClass().add("party-btn");
        closeButton.setAccessibleText("Adventuring-Day-Rechner schliessen");
        closeButton.setOnAction(event -> popup.hide());
        Region spacer = new Region();
        HBox.setHgrow(spacer, Priority.ALWAYS);
        HBox header = new HBox(6, headerLabel, spacer, closeButton);
        header.getStyleClass().add("party-header");
        header.setAlignment(Pos.CENTER_LEFT);

        summaryGrid.getStyleClass().add("adventuring-day-summary-grid");
        summaryGrid.setHgap(12);
        summaryGrid.setVgap(6);
        addRow(0, "Short Rest", shortRestValue);
        addRow(1, "Long Rest", longRestValue);
        addRow(2, "Tagesbudget", budgetValue);

        messageLabel.setWrapText(true);
        messageLabel.setPadding(new Insets(8, 12, 8, 12));

        VBox body = new VBox(8, summaryGrid, messageLabel);
        body.getStyleClass().add("adventuring-day-popup-body");
        return new VBox(header, body);
    }

    private void addRow(int row, String labelText, Label valueLabel) {
        Label label = new Label(labelText);
        label.getStyleClass().add("text-muted");
        valueLabel.getStyleClass().add("text-secondary");
        summaryGrid.add(label, 0, row);
        summaryGrid.add(valueLabel, 1, row);
    }

    private void togglePopup() {
        DropdownPopupView.toggleTrailing(popup, triggerButton, POPUP_WIDTH, onOpen);
    }

    record PanelContent(
            boolean loading,
            boolean error,
            boolean empty,
            String shortRestText,
            String longRestText,
            String budgetText,
            String message
    ) {

        PanelContent {
            shortRestText = safe(shortRestText);
            longRestText = safe(longRestText);
            budgetText = safe(budgetText);
            message = safe(message);
        }

        static PanelContent loadingContent() {
            return new PanelContent(true, false, false, "", "", "", "Lade...");
        }
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }
}
