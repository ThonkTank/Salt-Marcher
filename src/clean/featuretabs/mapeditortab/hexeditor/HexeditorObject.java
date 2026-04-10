package clean.featuretabs.mapeditortab.hexeditor;

import clean.featuretabs.mapeditortab.hexeditor.input.ComposeHexeditorInput;
import javafx.geometry.Insets;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

/**
 * Clean placeholder editor surface for Hexmap editing.
 */
public final class HexeditorObject {

    private final ComposeHexeditorInput.HexeditorInput hexeditor;

    public HexeditorObject(ComposeHexeditorInput input) {
        ComposeHexeditorInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.hexeditor = new HexeditorAssembly(resolvedInput).composeHexeditor();
    }

    public ComposeHexeditorInput.HexeditorInput composeHexeditor(ComposeHexeditorInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return hexeditor;
    }

    private static final class HexeditorAssembly {

        private final ComposeHexeditorInput input;

        private HexeditorAssembly(ComposeHexeditorInput input) {
            this.input = input;
        }

        private ComposeHexeditorInput.HexeditorInput composeHexeditor() {
            Label title = new Label("Map Editor: Hexmap");
            title.getStyleClass().add("heading");

            Label mapLabel = createMutedLabel("Aktive Karte: " + normalizeText(input.map().title()));
            Label summaryLabel = createMutedLabel(normalizeText(input.map().summary()));
            Label noteLabel = createMutedLabel(
                    "Der Editor-Surface hat automatisch auf den Hexmap-Unter-View gewechselt. Editor-Logik folgt spaeter.");

            VBox main = new VBox(12, title, mapLabel, summaryLabel, noteLabel);
            main.setPadding(new Insets(12));
            return new ComposeHexeditorInput.HexeditorInput(main);
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
