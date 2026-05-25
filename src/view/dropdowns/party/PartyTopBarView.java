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

public final class PartyTopBarView extends HBox {

    static final double POPUP_WIDTH = 380.0;
    static final String OPEN_ACCESSIBLE_TEXT = "Party-Panel geöffnet, Escape zum Schließen";
    static final String TOOLTIP_TEXT = "Party-Panel öffnen (Alt+P)";

    private Consumer<PartyTopBarViewInputEvent> viewInputEventHandler = ignored -> { };
    private final Label headerLabel = new StyledLabel();

    public PartyTopBarView(Node... content) {
        getStyleClass().add("party-topbar-root");
        getChildren().add(new PartyPanel(new PartyHeader(headerLabel, new CloseButton()), content));
    }

    public void bind(PartyTopBarContentModel contentModel) {
        PartyTopBarContentModel safeModel = Objects.requireNonNull(contentModel, "contentModel");
        headerLabel.textProperty().bind(safeModel.headerTitleProperty());
    }

    public void onViewInputEvent(Consumer<PartyTopBarViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    private final class CloseButton extends Button {

        private CloseButton() {
            super("x");
            getStyleClass().add("compact");
            setAccessibleText("Party-Panel schließen");
            setOnAction(event -> viewInputEventHandler.accept(new PartyTopBarViewInputEvent(true)));
        }
    }

    private static final class PartyHeader extends HBox {

        private PartyHeader(Node title, Node closeButton) {
            super(6, title, new HeaderSpacer(), closeButton);
            getStyleClass().add("party-header");
            setAlignment(Pos.CENTER_LEFT);
        }
    }

    private static final class HeaderSpacer extends Region {

        private HeaderSpacer() {
            setHgrow(this, Priority.ALWAYS);
        }
    }

    private static final class PartyPanel extends VBox {

        private PartyPanel(Node header, Node... content) {
            super(10, header);
            getStyleClass().add("party-panel");
            setFillWidth(true);
            getChildren().addAll(content);
        }
    }

    private static final class StyledLabel extends Label {

        private StyledLabel() {
            getStyleClass().add("title-large");
        }
    }
}
