package features.world.hexmap.ui.overworld;

import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import ui.components.ThemeColors;

/**
 * Linkes Kontrollpanel der Overworld-Ansicht.
 * Spaeter: Reisegeschwindigkeit, Geländetyp, Tageszeit und Wetter.
 */
public class OverworldControls extends VBox {

    public OverworldControls() {
        setSpacing(8);
        setPadding(new Insets(8));

        Label header = new Label("REISE");
        header.getStyleClass().addAll("section-header", "text-muted");

        Label placeholder = new Label("Reise-Einstellungen\n(Platzhalter)");
        placeholder.getStyleClass().add("text-muted");
        placeholder.setWrapText(true);

        getChildren().addAll(header, ThemeColors.controlSeparator(), placeholder);
    }
}
