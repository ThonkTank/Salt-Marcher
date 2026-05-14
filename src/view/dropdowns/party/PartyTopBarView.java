package src.view.dropdowns.party;

import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import src.view.slotcontent.topbar.dropdown.DropdownPopupContentModel;
import src.view.slotcontent.topbar.dropdown.DropdownPopupView;

@SuppressWarnings("PMD.LawOfDemeter")
public final class PartyTopBarView extends HBox {

    static final double POPUP_WIDTH = 380.0;
    static final String OPEN_ACCESSIBLE_TEXT = "Party-Panel geöffnet, Escape zum Schließen";
    static final String TOOLTIP_TEXT = "Party-Panel öffnen (Alt+P)";

    private final DropdownPopupView popupView;
    private Consumer<PartyTopBarViewInputEvent> viewInputEventHandler = ignored -> { };

    public PartyTopBarView(
            DropdownPopupContentModel popupContentModel,
            PartyRosterTopBarView rosterView,
            PartyEditorTopBarView editorView
    ) {
        setSpacing(8);
        setPadding(new Insets(4, 8, 4, 8));
        popupView = new DropdownPopupView(buildPanel(rosterView, editorView));
        popupView.bind(popupContentModel);
        getChildren().add(popupView);
    }

    public void onViewInputEvent(Consumer<PartyTopBarViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    DropdownPopupView dropdownPopupView() {
        return popupView;
    }

    private VBox buildPanel(
            PartyRosterTopBarView rosterView,
            PartyEditorTopBarView editorView
    ) {
        Button closeButton = new Button("x");
        addStyleClass(closeButton, "compact");
        closeButton.setAccessibleText("Party-Panel schließen");
        closeButton.setOnAction(event -> viewInputEventHandler.accept(new PartyTopBarViewInputEvent(true)));
        Region headerSpacer = new Region();
        setHgrow(headerSpacer, Priority.ALWAYS);
        Label headerLabel = new Label("PARTY");
        addStyleClass(headerLabel, "title-large");
        HBox header = new HBox(6, headerLabel, headerSpacer, closeButton);
        addStyleClass(header, "party-header");
        header.setAlignment(Pos.CENTER_LEFT);

        VBox panel = new VBox(10, header, rosterView, editorView);
        addStyleClass(panel, "party-panel");
        panel.setFillWidth(true);
        return panel;
    }

    private static void addStyleClass(javafx.scene.Node node, String styleClass) {
        node.getStyleClass().add(styleClass);
    }
}
