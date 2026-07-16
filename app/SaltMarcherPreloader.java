package app;

import javafx.application.Preloader;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Scene;
import javafx.scene.control.Label;
import javafx.scene.control.ProgressIndicator;
import javafx.scene.layout.VBox;
import javafx.stage.Stage;
import javafx.stage.StageStyle;

/**
 * Lightweight startup preloader for packaged desktop launches.
 */
public final class SaltMarcherPreloader extends Preloader {

    private Runnable hidePreloader = () -> {
    };

    @Override
    public void start(Stage primaryStage) {
        hidePreloader = primaryStage::hide;
        primaryStage.initStyle(StageStyle.UNDECORATED);
        primaryStage.setTitle("SaltMarcher");
        DesktopWindowIcons.applyTo(primaryStage);
        primaryStage.setScene(createScene());
        primaryStage.setResizable(false);
        primaryStage.centerOnScreen();
        primaryStage.show();
    }

    @Override
    public void handleApplicationNotification(PreloaderNotification notification) {
        if (notification instanceof AppReadyNotification) {
            hidePreloader.run();
        }
    }

    @Override
    public void handleStateChangeNotification(StateChangeNotification notification) {
        if (beforeStart(notification)) {
            hidePreloader.run();
        }
    }

    private static Scene createScene() {
        ProgressIndicator progressIndicator = new ProgressIndicator();
        progressIndicator.setMaxSize(56, 56);

        Label title = new Label("SaltMarcher");
        addStyleClass(title, "startup-title");

        Label subtitle = new Label("Desktop shell is starting...");
        addStyleClass(subtitle, "startup-subtitle");

        VBox card = new VBox(12, progressIndicator, title, subtitle);
        addStyleClass(card, "startup-card");
        card.setAlignment(Pos.CENTER);
        card.setPadding(new Insets(28));

        VBox root = new VBox(card);
        addStyleClass(root, "startup-root");
        root.setAlignment(Pos.CENTER);
        root.setPadding(new Insets(24));

        Scene scene = new Scene(root, 360, 220);
        scene.getStylesheets().add(SaltMarcherPreloader.class.getResource("/salt-marcher.css").toExternalForm());
        return scene;
    }

    private static boolean beforeStart(StateChangeNotification javaFxPreloaderStateChangeNotification) {
        StateChangeNotification.Type type = javaFxPreloaderStateChangeNotification.getType();
        return type == StateChangeNotification.Type.BEFORE_START;
    }

    private static void addStyleClass(Label label, String styleClass) {
        var styleClasses = label.getStyleClass();
        styleClasses.add(styleClass);
    }

    private static void addStyleClass(VBox box, String styleClass) {
        var styleClasses = box.getStyleClass();
        styleClasses.add(styleClass);
    }

    public static final class AppReadyNotification implements PreloaderNotification {
    }
}
