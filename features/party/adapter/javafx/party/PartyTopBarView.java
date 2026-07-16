package features.party.adapter.javafx.party;

import java.util.Objects;
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

    private Runnable closeHandler = () -> { };
    private final Label headerLabel = new StyledLabel();

    public PartyTopBarView(Node... content) {
        getStyleClass().add("party-topbar-root");
        getChildren().add(new PartyPanel(new PartyHeader(headerLabel, new CloseButton()), content));
    }

    public void bind(PartyTopBarViewModel viewModel) {
        PartyTopBarViewModel safeModel = Objects.requireNonNull(viewModel, "viewModel");
        headerLabel.textProperty().bind(safeModel.headerTitleProperty());
    }

    public void onCloseRequested(Runnable handler) {
        closeHandler = handler == null ? () -> { } : handler;
    }

    private final class CloseButton extends Button {

        private CloseButton() {
            super(PartyTopBarVocabulary.CLOSE_BUTTON_TEXT);
            getStyleClass().add("compact");
            setAccessibleText(PartyTopBarVocabulary.CLOSE_ACCESSIBLE_TEXT);
            setOnAction(event -> closeHandler.run());
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
