package clean;

import clean.featuretabs.FeaturetabsObject;
import clean.featuretabs.input.ComposeFeaturetabsInput;
import clean.shell.ShellObject;
import clean.shell.async.input.ComposeAsyncInput;
import clean.shell.input.ComposeShellInput;
import clean.shell.inspector.input.ComposeInspectorInput;
import clean.shell.scene.input.ComposeSceneInput;
import clean.startup.StartupObject;
import clean.startup.input.StartApplicationInput;
import javafx.application.Application;
import javafx.application.Platform;
import javafx.scene.control.Alert;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import javafx.stage.Stage;

/**
 * Public root seam for the isolated clean application lifecycle.
 */
@SuppressWarnings("unused")
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
            ComposeFeaturetabsInput composeFeaturetabsInput = new ComposeFeaturetabsInput();
            ComposeFeaturetabsInput.FeaturetabsInput featuretabs =
                    new FeaturetabsObject(composeFeaturetabsInput).composeFeaturetabs(composeFeaturetabsInput);
            ComposeShellInput composeShellInput = new ComposeShellInput(
                    featuretabs.surfaces(),
                    featuretabs.initialSurfaceId()
            );
            ComposeShellInput.ShellInput shell = new ShellObject(composeShellInput).composeShell(composeShellInput);
            bootstrapShellHooks(shell.hooks());

            StartApplicationInput startApplicationInput = new StartApplicationInput(
                    input.primaryStage(),
                    "Salt Marcher",
                    shell.root()
            );
            new StartupObject(startApplicationInput).startApplication(startApplicationInput);
        }

        private void bootstrapShellHooks(ComposeShellInput.ShellHooksInput hooks) {
            if (hooks == null) {
                return;
            }
            publishInspectorInfo(hooks);
            ComposeSceneInput.HandleInput sceneHandle = registerScene(hooks);
            submitAsyncBootstrap(hooks, sceneHandle);
        }

        private void publishInspectorInfo(ComposeShellInput.ShellHooksInput hooks) {
            if (hooks.inspectorNavigator() == null) {
                return;
            }
            hooks.inspectorNavigator().showInfo().accept(new ComposeInspectorInput.InfoEntryInput(
                    "Clean Shell",
                    "clean-shell:overview",
                    "Die Clean-Shell traegt jetzt 5 Top-Level-Featuretabs und bindet Inspector, Scene und Async shell-owned ein."
            ));
        }

        private ComposeSceneInput.HandleInput registerScene(ComposeShellInput.ShellHooksInput hooks) {
            if (hooks.sceneRegistry() == null) {
                return null;
            }
            VBox initialContent = new VBox(
                    8,
                    new Label("Clean Shell aktiv"),
                    new Label("Die globale Szene wurde beim Start fuer die vorbereiteten Featuretabs registriert.")
            );
            initialContent.getStyleClass().add("card");
            ComposeSceneInput.HandleInput handle = hooks.sceneRegistry().registerScene().apply(
                    new ComposeSceneInput.RegistrationInput("Clean", initialContent)
            );
            if (handle != null) {
                handle.activate().run();
            }
            return handle;
        }

        private void submitAsyncBootstrap(
                ComposeShellInput.ShellHooksInput hooks,
                ComposeSceneInput.HandleInput sceneHandle
        ) {
            if (hooks.async() == null) {
                return;
            }
            hooks.async().submitBackground().accept(new ComposeAsyncInput.SubmitBackgroundInput(
                    "Clean shell bootstrap",
                    () -> {
                        Thread.sleep(50L);
                        return null;
                    },
                    () -> showAsyncReady(hooks, sceneHandle),
                    throwable -> showAsyncFailure(hooks, throwable),
                    null
            ));
        }

        private void showAsyncReady(
                ComposeShellInput.ShellHooksInput hooks,
                ComposeSceneInput.HandleInput sceneHandle
        ) {
            if (sceneHandle != null) {
                VBox readyContent = new VBox(
                        8,
                        new Label("Async bereit"),
                        new Label("Der shell-owned Hintergrundpfad hat den globalen Clean-Status aktualisiert.")
                );
                readyContent.getStyleClass().add("card");
                sceneHandle.setContent().accept(readyContent);
                sceneHandle.activate().run();
            }
            if (hooks.inspectorNavigator() == null) {
                return;
            }
            hooks.inspectorNavigator().showContent().accept(new ComposeInspectorInput.HostedEntryInput(
                    "Shell Status",
                    "clean-shell:status",
                    this::createShellStatusContent
            ));
        }

        private VBox createShellStatusContent() {
            VBox hostedContent = new VBox(
                    10,
                    new Label("Shell bereit"),
                    new Label("Navigation, Inspector, Scene und Async laufen ohne Legacy-Shell."),
                    new Label("Encounter, Travel, Map Editor, Tabellen und Zauber sind als Clean-Top-Level vorbereitet.")
            );
            hostedContent.setFillWidth(true);
            return hostedContent;
        }

        private void showAsyncFailure(ComposeShellInput.ShellHooksInput hooks, Throwable throwable) {
            if (hooks.inspectorNavigator() == null) {
                return;
            }
            hooks.inspectorNavigator().showInfo().accept(new ComposeInspectorInput.InfoEntryInput(
                    "Async Fehler",
                    "clean-shell:async-error",
                    throwable == null || throwable.getMessage() == null
                            ? "Die Demo-Hintergrundaufgabe ist ohne Detailmeldung fehlgeschlagen."
                            : throwable.getMessage()
            ));
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
