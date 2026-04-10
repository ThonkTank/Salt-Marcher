package clean;

import clean.input.ShowApplicationInput;
import javafx.application.Application;
import javafx.application.Platform;
import javafx.scene.Scene;
import javafx.scene.control.Alert;
import javafx.scene.control.Label;
import javafx.scene.layout.VBox;
import javafx.stage.Stage;

/**
 * Public root seam for the isolated clean application lifecycle.
 */
@SuppressWarnings("unused")
public final class CleanObject {

    public void showApplication(ShowApplicationInput input) {
        java.util.Objects.requireNonNull(input, "input");
    }

    public static final class Runtime extends Application {

        @Override
        public void start(Stage primaryStage) {
            try {
                new CleanObject().showApplication(new ShowApplicationInput(primaryStage));
                Label titleLabel = new Label("Salt Marcher");
                Label surfaceLabel = new Label("Clean Start");
                Label summaryLabel = new Label("Isolierter Clean-Einstieg");
                VBox root = new VBox(12, titleLabel, surfaceLabel, summaryLabel);
                Scene scene = new Scene(root, 1280, 800);
                primaryStage.setTitle("Salt Marcher");
                primaryStage.setScene(scene);
                primaryStage.setMinWidth(960);
                primaryStage.setMinHeight(640);
                primaryStage.show();
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
