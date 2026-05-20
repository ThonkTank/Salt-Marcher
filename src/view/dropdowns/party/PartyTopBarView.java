package src.view.dropdowns.party;

import java.util.Objects;
import java.util.function.Consumer;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;

@SuppressWarnings("PMD.LawOfDemeter")
public final class PartyTopBarView extends HBox {

    static final double POPUP_WIDTH = 380.0;
    static final String OPEN_ACCESSIBLE_TEXT = "Party-Panel geöffnet, Escape zum Schließen";
    static final String TOOLTIP_TEXT = "Party-Panel öffnen (Alt+P)";

    private Consumer<PartyTopBarViewInputEvent> viewInputEventHandler = ignored -> { };
    private final Label headerLabel = new Label();

    public PartyTopBarView(Node... content) {
        getStyleClass().add("party-topbar-root");
        getChildren().add(buildPanel(content));
    }

    public void bind(PartyTopBarContentModel contentModel) {
        PartyTopBarContentModel safeModel = Objects.requireNonNull(contentModel, "contentModel");
        headerLabel.textProperty().bind(safeModel.headerTitleProperty());
    }

    public void onViewInputEvent(Consumer<PartyTopBarViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private VBox buildPanel(Node... content) {
        Button closeButton = new Button("x");
        addStyleClass(closeButton, "compact");
        closeButton.setAccessibleText("Party-Panel schließen");
        closeButton.setOnAction(event -> viewInputEventHandler.accept(new PartyTopBarViewInputEvent(true)));
        Region headerSpacer = new Region();
        setHgrow(headerSpacer, Priority.ALWAYS);
        addStyleClass(headerLabel, "title-large");
        HBox header = new HBox(6, headerLabel, headerSpacer, closeButton);
        addStyleClass(header, "party-header");
        header.setAlignment(Pos.CENTER_LEFT);

        VBox panel = new VBox(10, header);
        panel.getChildren().addAll(content);
        addStyleClass(panel, "party-panel");
        panel.setFillWidth(true);
        return panel;
    }

    private static void addStyleClass(javafx.scene.Node node, String styleClass) {
        node.getStyleClass().add(styleClass);
    }
}
