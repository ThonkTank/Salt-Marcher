package clean;

import clean.creatures.CreaturesObject;
import clean.creatures.input.ComposeCatalogcontentInput;
import clean.encounter.EncounterObject;
import clean.encounter.input.ComposeEncounterInput;
import clean.featuretabs.FeaturetabsObject;
import clean.featuretabs.input.ComposeFeaturetabsInput;
import clean.shell.ShellObject;
import clean.shell.input.ComposeShellInput;
import clean.startup.StartupObject;
import clean.startup.input.StartApplicationInput;
import javafx.application.Application;
import javafx.application.Platform;
import javafx.scene.control.Alert;
import javafx.stage.Stage;

/**
 * Public root seam for the isolated clean application lifecycle.
 */
public final class CleanObject {

    private final clean.input.ShowApplicationInput shownApplication;

    public CleanObject(clean.input.ShowApplicationInput input) {
        clean.input.ShowApplicationInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        new CleanAssembly(resolvedInput).showApplication();
        this.shownApplication = resolvedInput;
    }

    public clean.input.ShowApplicationInput showApplication(clean.input.ShowApplicationInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return shownApplication;
    }

    private static final class CleanAssembly {

        private final clean.input.ShowApplicationInput input;

        private CleanAssembly(clean.input.ShowApplicationInput input) {
            this.input = input;
        }

        private void showApplication() {
            ComposeEncounterInput composeEncounterInput = new ComposeEncounterInput();
            ComposeEncounterInput.EncounterInput encounter =
                    new EncounterObject(composeEncounterInput).composeEncounter(composeEncounterInput);

            ComposeCatalogcontentInput composeCatalogcontentInput = new ComposeCatalogcontentInput(
                    rowActionInput -> encounter.addCreature().accept(new ComposeEncounterInput.AddCreatureInput(
                            rowActionInput.creatureId(),
                            rowActionInput.creatureName()
                    )),
                    "+Add"
            );
            ComposeCatalogcontentInput.CatalogcontentInput catalogcontent =
                    new CreaturesObject(composeCatalogcontentInput).composeCatalogcontent(composeCatalogcontentInput);

            ComposeFeaturetabsInput composeFeaturetabsInput = new ComposeFeaturetabsInput(catalogcontent);
            ComposeFeaturetabsInput.FeaturetabsInput featuretabs =
                    new FeaturetabsObject(composeFeaturetabsInput).composeFeaturetabs(composeFeaturetabsInput);
            ComposeShellInput composeShellInput = new ComposeShellInput(
                    featuretabs.surfaces(),
                    featuretabs.initialSurfaceId()
            );
            ComposeShellInput.ShellInput shell = new ShellObject(composeShellInput).composeShell(composeShellInput);
            if (shell.hooks() != null) {
                encounter.onShellReady().accept(shell.hooks());
            }

            StartApplicationInput startApplicationInput = new StartApplicationInput(
                    input.primaryStage(),
                    "Salt Marcher",
                    shell.root()
            );
            new StartupObject(startApplicationInput).startApplication(startApplicationInput);
        }
    }

    public static final class Runtime extends Application {

        @Override
        public void start(Stage primaryStage) {
            try {
                clean.input.ShowApplicationInput input = new clean.input.ShowApplicationInput(primaryStage);
                new CleanObject(input).showApplication(input);
            } catch (RuntimeException exception) {
                Alert alert = new Alert(Alert.AlertType.ERROR);
                alert.setTitle("Start fehlgeschlagen");
                alert.setHeaderText("Salt Marcher konnte nicht gestartet werden.");
                alert.setContentText(exception.getMessage() == null
                        ? "Unbekannter Fehler beim Start."
                        : exception.getMessage());
                alert.showAndWait();
                Platform.exit();
            }
        }
    }
}
