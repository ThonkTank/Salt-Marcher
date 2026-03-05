package ui.overworld;

import javafx.geometry.Pos;
import javafx.scene.control.Label;
import javafx.scene.layout.StackPane;

/**
 * Placeholder for the hex grid map.
 * Future: JavaFX Canvas-based hex tile renderer with party token.
 */
public class HexMapPane extends StackPane {

    public HexMapPane() {
        getStyleClass().add("hex-map-pane");
        setMinSize(200, 200);

        Label placeholder = new Label("Hex-Karte\n(Platzhalter)");
        placeholder.getStyleClass().addAll("text-muted", "hex-map-placeholder");
        placeholder.setAlignment(Pos.CENTER);

        getChildren().add(placeholder);
        setAlignment(Pos.CENTER);
    }
}
