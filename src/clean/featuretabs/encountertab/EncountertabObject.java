package clean.featuretabs.encountertab;

import clean.creatures.input.ComposeEncounterhostInput;
import clean.featuretabs.encountertab.input.ComposeEncountertabInput;
import clean.shell.input.ComposeShellInput;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;

/**
 * Top-level clean encounter surface that now hosts the first reusable creature slice.
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
            ComposeEncounterhostInput.EncounterhostInput encounterhost = input.encounterhost();
            return new ComposeEncountertabInput.EncountertabInput(new ComposeShellInput.SurfaceInput(
                    "encounter",
                    "Encounter",
                    "session",
                    "E",
                    input.navigationGraphic(),
                    null,
                    createControls(encounterhost),
                    createMain(encounterhost),
                    null,
                    null,
                    null,
                    null,
                    encounterhost == null ? null : encounterhost.onShellReady()
            ));
        }

        private static Node createControls(ComposeEncounterhostInput.EncounterhostInput encounterhost) {
            Node hostedControls = encounterhost == null ? createMissingContent() : encounterhost.controlsContent();
            VBox controls = new VBox(
                    8,
                    createSectionLabel("Session"),
                    createMutedLabel("Encounter hostet jetzt den ersten sauberen Creature-Browser als Grundlage fuer die spaetere Builder-Migration."),
                    hostedControls
            );
            controls.setFillWidth(true);
            controls.setPadding(new Insets(12));
            return controls;
        }

        private static Node createMain(ComposeEncounterhostInput.EncounterhostInput encounterhost) {
            if (encounterhost == null || encounterhost.mainContent() == null) {
                return createMissingContent();
            }
            VBox main = new VBox(
                    8,
                    createMutedLabel("Die eigentliche Encounter-Runtime folgt spaeter. Dieser Slice migriert zuerst den wiederverwendbaren Creature-Katalog."),
                    encounterhost.mainContent()
            );
            VBox.setVgrow(encounterhost.mainContent(), javafx.scene.layout.Priority.ALWAYS);
            main.setPadding(new Insets(12));
            main.setFillWidth(true);
            return main;
        }

        private static Label createSectionLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("subheading");
            return label;
        }

        private static Label createTitleLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("heading");
            return label;
        }

        private static Label createMutedLabel(String text) {
            Label label = new Label(text);
            label.getStyleClass().add("text-muted");
            label.setWrapText(true);
            return label;
        }

        private static Node createMissingContent() {
            VBox fallback = new VBox(
                    12,
                    createTitleLabel("Encounter"),
                    createMutedLabel("Der Clean-Creature-Host konnte nicht vorbereitet werden.")
            );
            fallback.setPadding(new Insets(12));
            return fallback;
        }
    }
}
