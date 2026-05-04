package src.view.dropdowns.party;

import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import src.view.slotcontent.primitives.popup.AnchoredPopupView;
import src.view.slotcontent.topbar.dropdown.DropdownPopupView;

public final class PartyTopBarView extends HBox {

    private static final double POPUP_WIDTH = 380.0;

    private final Button triggerButton = new Button("Keine _Party ▼");
    private final AnchoredPopupView popup = new AnchoredPopupView();
    private Consumer<PartyTopBarViewInputEvent> viewInputEventHandler = ignored -> { };

    public PartyTopBarView(
            PartyRosterTopBarView rosterView,
            PartyEditorTopBarView editorView
    ) {
        setSpacing(8);
        setPadding(new Insets(4, 8, 4, 8));
        configureTrigger();
        popup.setContent(buildPanel(rosterView, editorView));
        popup.addOnShowing(event -> triggerButton.setAccessibleText("Party-Panel geöffnet, Escape zum Schließen"));
        popup.addOnHiding(event -> triggerButton.setAccessibleText(triggerButton.getText().replace("_", "")));
        getChildren().add(triggerButton);
    }

    public void setTriggerText(String text) {
        String safeText = safe(text);
        triggerButton.setText(safeText);
        triggerButton.setAccessibleText(safeText.replace("_", ""));
    }

    public void onViewInputEvent(Consumer<PartyTopBarViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private void configureTrigger() {
        triggerButton.getStyleClass().add("text-secondary");
        triggerButton.setMnemonicParsing(true);
        triggerButton.setTooltip(new Tooltip("Party-Panel öffnen (Alt+P)"));
        triggerButton.setOnAction(event -> togglePopup());
    }

    private VBox buildPanel(
            PartyRosterTopBarView rosterView,
            PartyEditorTopBarView editorView
    ) {
        Button closeButton = new Button("x");
        closeButton.getStyleClass().add("compact");
        closeButton.setAccessibleText("Party-Panel schließen");
        closeButton.setOnAction(event -> popup.hide());
        Region headerSpacer = new Region();
        HBox.setHgrow(headerSpacer, Priority.ALWAYS);
        Label headerLabel = new Label("PARTY");
        headerLabel.getStyleClass().add("title-large");
        HBox header = new HBox(6, headerLabel, headerSpacer, closeButton);
        header.getStyleClass().add("party-header");
        header.setAlignment(Pos.CENTER_LEFT);

        VBox panel = new VBox(10, header, rosterView, editorView);
        panel.getStyleClass().add("party-panel");
        panel.setFillWidth(true);
        return panel;
    }

    private void togglePopup() {
        DropdownPopupView.toggleTrailing(
                popup,
                triggerButton,
                POPUP_WIDTH,
                () -> viewInputEventHandler.accept(new PartyTopBarViewInputEvent()));
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }
}
