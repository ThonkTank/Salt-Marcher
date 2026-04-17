package bootstrap;

import javafx.application.Preloader;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Scene;
import javafx.scene.control.Label;
import javafx.scene.control.ProgressIndicator;
import javafx.scene.layout.VBox;
import javafx.stage.Stage;
import javafx.stage.StageStyle;
import org.jspecify.annotations.Nullable;

/**
 * Lightweight startup preloader for packaged desktop launches.
 */
public final class SaltMarcherPreloader extends Preloader {

    private @Nullable Stage stage;

    @Override
    public void start(Stage primaryStage) {
        stage = primaryStage;
        stage.initStyle(StageStyle.UNDECORATED);
        stage.setTitle("SaltMarcher");
        DesktopWindowIcons.applyTo(stage);
        stage.setScene(createScene());
        stage.setResizable(false);
        stage.centerOnScreen();
        stage.show();
    }

    @Override
    public void handleApplicationNotification(PreloaderNotification notification) {
        if (notification instanceof AppReadyNotification && stage != null) {
            stage.hide();
        }
    }

    @Override
    public void handleStateChangeNotification(StateChangeNotification notification) {
        if (stage == null) {
            return;
        }
        switch (notification.getType()) {
            case BEFORE_START -> stage.hide();
            default -> {
            }
        }
    }

    private static Scene createScene() {
        ProgressIndicator progressIndicator = new ProgressIndicator();
        progressIndicator.setMaxSize(56, 56);

        Label title = new Label("SaltMarcher");
        title.getStyleClass().add("startup-title");

        Label subtitle = new Label("Desktop shell is starting...");
        subtitle.getStyleClass().add("startup-subtitle");

        VBox card = new VBox(12, progressIndicator, title, subtitle);
        card.getStyleClass().add("startup-card");
        card.setAlignment(Pos.CENTER);
        card.setPadding(new Insets(28));

        VBox root = new VBox(card);
        root.getStyleClass().add("startup-root");
        root.setAlignment(Pos.CENTER);
        root.setPadding(new Insets(24));

        Scene scene = new Scene(root, 360, 220);
        scene.getStylesheets().add(
                SaltMarcherPreloader.class.getResource("/salt-marcher.css").toExternalForm());
        return scene;
    }

    public static final class AppReadyNotification implements PreloaderNotification {
    }
}
