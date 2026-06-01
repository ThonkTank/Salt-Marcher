package bootstrap;

import javafx.scene.Scene;
import javafx.scene.image.Image;
import javafx.stage.Stage;

final class BootstrapFx {

    private BootstrapFx() {
    }

    static void addStylesheet(Scene scene, String stylesheet) {
        var stylesheets = scene.getStylesheets();
        stylesheets.add(stylesheet);
    }

    static void setWindowIcon(Stage stage, Image icon) {
        var icons = stage.getIcons();
        icons.setAll(icon);
    }
}
