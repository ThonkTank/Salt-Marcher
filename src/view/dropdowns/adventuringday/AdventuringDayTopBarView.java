package src.view.dropdowns.adventuringday;

import java.util.function.Consumer;
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
import src.view.slotcontent.primitives.dialog.DialogSurfaceView;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView.BodyPolicy;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;
import src.view.slotcontent.topbar.dropdown.DropdownPopupView;

public final class AdventuringDayTopBarView extends HBox {

    private static final double POPUP_WIDTH = 420.0;

    private final Button triggerButton = new Button("Rastbudget \u25be");
    private final AnchoredPopupView popup = new AnchoredPopupView();
    private final AdventuringDayCalculatorTopBarView calculatorPane = new AdventuringDayCalculatorTopBarView();
    private Consumer<AdventuringDayTopBarViewInputEvent> viewInputEventHandler = ignored -> { };

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

    void showCalculation(AdventuringDayCalculatorTopBarView.Calculation calculation) {
        calculatorPane.showCalculation(calculation);
    }

    void onViewInputEvent(Consumer<AdventuringDayTopBarViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private void configureTrigger() {
        triggerButton.getStyleClass().add("text-secondary");
        triggerButton.setTooltip(new Tooltip("Adventuring-Day-Rechner \u00f6ffnen"));
        triggerButton.setOnAction(event -> togglePopup());
    }

    private void configurePopup() {
        DialogSurfaceView panel = buildPanel();
        panel.getStyleClass().addAll("party-panel", "adventuring-day-toolbar-popup");
        popup.setContent(panel);
        calculatorPane.onViewInputEvent(event -> publish(AdventuringDayTopBarViewInputEvent.calculate(
                event.levels(),
                event.totalGroupXp())));
    }

    private DialogSurfaceView buildPanel() {
        DialogSurfaceView dialog = new DialogSurfaceView();
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
        dialog.setHeader(header);
        dialog.setBody(body, BodyPolicy.FIXED);
        return dialog;
    }

    private void togglePopup() {
        DropdownPopupView.toggleTrailing(
                popup,
                triggerButton,
                POPUP_WIDTH,
                () -> publish(AdventuringDayTopBarViewInputEvent.opened()));
    }

    private void publish(AdventuringDayTopBarViewInputEvent event) {
        viewInputEventHandler.accept(event);
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
