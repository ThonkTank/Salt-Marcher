package clean;

import clean.frame.FrameObject;
import clean.frame.input.ComposeFrameInput;
import clean.navigation.NavigationObject;
import clean.navigation.input.ComposeNavigationInput;
import clean.placeholder.PlaceholderObject;
import clean.placeholder.input.ComposePlaceholderInput;
import clean.startup.StartupObject;
import clean.startup.input.StartApplicationInput;
import javafx.application.Application;
import javafx.application.Platform;
import javafx.scene.control.Alert;
import javafx.stage.Stage;

/**
 * Public root seam for the isolated clean application lifecycle.
 */
@SuppressWarnings("unused")
public final class CleanObject {

    private final PlaceholderObject placeholderObject = new PlaceholderObject();
    private final NavigationObject navigationObject = new NavigationObject();
    private final FrameObject frameObject = new FrameObject();

    public ComposeFrameInput.FrameInput showApplication(clean.input.ShowApplicationInput input) {
        if (input == null) {
            throw new NullPointerException("input");
        }
        ComposePlaceholderInput composePlaceholderInput = new ComposePlaceholderInput(
                "start",
                "Clean Start",
                "Start",
                "Isolierter Clean-Einstieg",
                "Lifecycle laeuft ueber src/clean.",
                "Kein Legacy-Import im Start-Slice.",
                "Naechster Ausbau erfolgt owner-konform.",
                "Dies ist die erste owner-konforme Clean-Surface.",
                "Sie bildet den Einstieg fuer weitere Slices.",
                "Navigation ist hier bewusst noch statisch.",
                "Status: buildfaehig.",
                "Status: isoliert.",
                "Status: bereit fuer den naechsten Slice."
        );
        ComposeNavigationInput.SurfaceInput startSurface =
                placeholderObject.composePlaceholder(composePlaceholderInput);
        ComposeNavigationInput composeNavigationInput = new ComposeNavigationInput(startSurface);
        ComposeNavigationInput.NavigationInput navigation =
                navigationObject.composeNavigation(composeNavigationInput);
        ComposeFrameInput composeFrameInput = new ComposeFrameInput(
                navigation.toolbarContent(),
                navigation.navigationContent(),
                navigation.controlsContent(),
                navigation.mainContent(),
                navigation.detailsContent(),
                navigation.stateContent()
        );
        return frameObject.composeFrame(composeFrameInput);
    }

    public static final class Runtime extends Application {

        @Override
        public void start(Stage primaryStage) {
            try {
                CleanObject cleanObject = new CleanObject();
                ComposeFrameInput.FrameInput frame =
                        cleanObject.showApplication(new clean.input.ShowApplicationInput(primaryStage));
                StartApplicationInput startApplicationInput = new StartApplicationInput(
                        primaryStage,
                        "Salt Marcher",
                        frame.root()
                );
                new StartupObject().startApplication(startApplicationInput);
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
