package clean.featuretabs.traveltab.hextravel;

import clean.featuretabs.traveltab.hextravel.input.ComposeHextravelInput;
import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

/**
 * Clean placeholder runtime surface for Hexmap travel.
 */
@SuppressWarnings("unused")
public final class HextravelObject {

    private final ComposeHextravelInput.HextravelInput hextravel;

    public HextravelObject(ComposeHextravelInput input) {
        ComposeHextravelInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.hextravel = new HextravelAssembly(resolvedInput).composeHextravel();
    }

    public ComposeHextravelInput.HextravelInput composeHextravel(ComposeHextravelInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return hextravel;
    }

    private static final class HextravelAssembly {

        private final ComposeHextravelInput input;

        private HextravelAssembly(ComposeHextravelInput input) {
            this.input = input;
        }

        private ComposeHextravelInput.HextravelInput composeHextravel() {
            Label title = new Label("Travel: Hexmap");
            title.getStyleClass().add("heading");

            Label mapLabel = createMutedLabel("Aktive Karte: " + normalizeText(input.map().title()));
            Label summaryLabel = createMutedLabel(normalizeText(input.map().summary()));
            Label noteLabel = createMutedLabel(
                    "Die Travel-Shell hat automatisch auf den Hexmap-Unter-View gewechselt. Runtime-Logik folgt spaeter.");

            VBox main = new VBox(12, title, mapLabel, summaryLabel, noteLabel);
            main.setPadding(new Insets(12));
            return new ComposeHextravelInput.HextravelInput(main);
        }

        private static Label createMutedLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("text-muted");
            label.setWrapText(true);
            return label;
        }

        private static String normalizeText(String value) {
            return value == null ? "" : value.trim();
        }
    }
}
