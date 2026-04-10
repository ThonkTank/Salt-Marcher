package clean.featuretabs.encountertab;

import clean.featuretabs.encountertab.input.ComposeEncountertabInput;
import clean.shell.input.ComposeShellInput;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

/**
 * Top-level clean placeholder surface for encounter workflow.
 */
@SuppressWarnings("unused")
public final class EncountertabObject {

    private final ComposeEncountertabInput.EncountertabInput encountertab;

    public EncountertabObject(ComposeEncountertabInput input) {
        ComposeEncountertabInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.encountertab = new EncountertabAssembly(resolvedInput).composeEncountertab();
    }

    public ComposeEncountertabInput.EncountertabInput composeEncountertab(ComposeEncountertabInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return encountertab;
    }

    private static final class EncountertabAssembly {

        private final ComposeEncountertabInput input;

        private EncountertabAssembly(ComposeEncountertabInput input) {
            this.input = input;
        }

        private ComposeEncountertabInput.EncountertabInput composeEncountertab() {
            return new ComposeEncountertabInput.EncountertabInput(new ComposeShellInput.SurfaceInput(
                    "encounter",
                    "Encounter",
                    "session",
                    "E",
                    input.navigationGraphic(),
                    null,
                    createControls(),
                    createMain(),
                    null,
                    null,
                    null,
                    null
            ));
        }

        private static Node createControls() {
            VBox controls = new VBox(
                    8,
                    createSectionLabel("Session"),
                    createMutedLabel("Encounter ist als eigener Clean-Top-Level vorbereitet."),
                    createMutedLabel("Initiative, Parties und Kampfablauf werden spaeter hier eingehangen.")
            );
            controls.setFillWidth(true);
            controls.setPadding(new Insets(12));
            return controls;
        }

        private static Node createMain() {
            VBox main = new VBox(
                    12,
                    createTitleLabel("Encounter"),
                    createMutedLabel("Der Clean-Einstieg reserviert diesen Surface fuer die kuenftige Encounter-Runtime."),
                    createMutedLabel("Legacy-Encounterlogik ist noch nicht angebunden.")
            );
            main.setPadding(new Insets(12));
            return main;
        }

        private static Label createSectionLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().addAll("section-header", "text-muted");
            return label;
        }

        private static Label createTitleLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("title");
            return label;
        }

        private static Label createMutedLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("text-muted");
            label.setWrapText(true);
            return label;
        }
    }
}
