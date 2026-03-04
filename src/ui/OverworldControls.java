package ui;

import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

/**
 * Left control panel for the Overworld view.
 * Future: travel speed selector, terrain type, time-of-day, weather controls.
 */
public class OverworldControls extends VBox {

    public OverworldControls() {
        setSpacing(8);
        setPadding(new Insets(8));
        getStyleClass().add("control-panel");

        Label header = new Label("REISE");
        header.getStyleClass().addAll("section-header", "text-muted");

        Label placeholder = new Label("Reise-Einstellungen\n(Platzhalter)");
        placeholder.getStyleClass().add("text-muted");
        placeholder.setWrapText(true);

        getChildren().addAll(header, ThemeColors.controlSeparator(), placeholder);
    }
}
