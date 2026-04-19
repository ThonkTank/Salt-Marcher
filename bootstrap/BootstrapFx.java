package bootstrap;

import javafx.scene.Scene;
import javafx.scene.image.Image;
import javafx.stage.Stage;

final class BootstrapFx {

    private BootstrapFx() {
    }

    @SuppressWarnings("PMD.LawOfDemeter")
    static void addStylesheet(Scene scene, String stylesheet) {
        scene.getStylesheets().add(stylesheet);
    }

    @SuppressWarnings("PMD.LawOfDemeter")
    static void setWindowIcon(Stage stage, Image icon) {
        stage.getIcons().setAll(icon);
    }
}
