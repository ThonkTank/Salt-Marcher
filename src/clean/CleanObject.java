package clean;

import clean.placeholder.PlaceholderObject;
import clean.placeholder.input.ComposePlaceholderInput;
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
            ComposePlaceholderInput startSurfaceInput = createStartSurfaceInput();
            ComposeShellInput.SurfaceInput startSurface =
                    new PlaceholderObject(startSurfaceInput).composePlaceholder(startSurfaceInput);

            ComposePlaceholderInput frameworkSurfaceInput = createFrameworkSurfaceInput();
            ComposeShellInput.SurfaceInput frameworkSurface =
                    new PlaceholderObject(frameworkSurfaceInput).composePlaceholder(frameworkSurfaceInput);

            ComposeShellInput composeShellInput = new ComposeShellInput(
                    java.util.List.of(startSurface, frameworkSurface),
                    "start"
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

        private ComposePlaceholderInput createStartSurfaceInput() {
            return new ComposePlaceholderInput(
                    "start",
                    "Clean Start",
                    "Start",
                    "Isolierter Clean-Einstieg",
                    "Die neue Shell lebt jetzt unter clean/shell und traegt Navigation, Inspector, Szene und Async.",
                    "Sidebar, Toolbar und Cockpit stammen nicht mehr aus dem Bootstrap.",
                    "Die Feature-Anbindung erfolgt kuenftig ueber passive Surface-Pakete.",
                    "Naechster Schritt ist das Einhaengen einzelner Features in diese Shell.",
                    null,
                    null,
                    null,
                    null,
                    null
            );
        }

        private ComposePlaceholderInput createFrameworkSurfaceInput() {
            return new ComposePlaceholderInput(
                    "frameworks",
                    "Framework Slice",
                    "Shell",
                    "Dieser Demo-Surface beschreibt genau die Grundschicht, an die spaeter Features andocken.",
                    "Globaler Inspector als read-mostly Details-Flaeche.",
                    "Globale Scene-Tabs fuer persistente Aktivitaeten im unteren rechten Pane.",
                    "Zentrale Async-Hooks fuer Hintergrundarbeit und Fehlerpfade.",
                    null,
                    null,
                    null,
                    null,
                    null,
                    null
            );
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
                    "Inspector, Scene und Async werden jetzt shell-owned in src/clean/shell bereitgestellt."
            ));
        }

        private ComposeSceneInput.HandleInput registerScene(ComposeShellInput.ShellHooksInput hooks) {
            if (hooks.sceneRegistry() == null) {
                return null;
            }
            VBox initialContent = new VBox(
                    8,
                    new Label("Shell-Framework aktiv"),
                    new Label("Die globale Szene wurde beim Start ueber die neuen Shell-Hooks registriert.")
            );
            initialContent.getStyleClass().add("list-card");
            ComposeSceneInput.HandleInput handle = hooks.sceneRegistry().registerScene().apply(
                    new ComposeSceneInput.RegistrationInput("Shell", initialContent)
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
                        new Label("Der shell-owned Hintergrundpfad hat den Demo-Status aktualisiert.")
                );
                readyContent.getStyleClass().add("list-card");
                sceneHandle.setContent().accept(readyContent);
                sceneHandle.activate().run();
            }
            if (hooks.inspectorNavigator() == null) {
                return;
            }
            hooks.inspectorNavigator().showContent().accept(new ComposeInspectorInput.HostedEntryInput(
                    "Framework Status",
                    "clean-shell:status",
                    this::createFrameworkStatusContent
            ));
        }

        private VBox createFrameworkStatusContent() {
            VBox hostedContent = new VBox(
                    10,
                    new Label("Shell bereit"),
                    new Label("Navigation, Inspector, Scene und Async laufen ohne Legacy-Shell."),
                    new Label("Die naechsten Slices koennen nun passive Surfaces einhaengen.")
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
