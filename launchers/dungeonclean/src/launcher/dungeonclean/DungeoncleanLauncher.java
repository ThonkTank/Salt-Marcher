package launcher.dungeonclean;

import features.appshell.AppshellObject;
import features.appshell.input.ComposeShellInput;
import features.world.dungeonclean.DungeoncleanObject;
import javafx.application.Application;
import javafx.scene.Scene;
import javafx.stage.Stage;
import launcher.dungeonclean.startup.StartupObject;
import launcher.dungeonclean.startup.input.ShowMainStageInput;
import launcher.dungeonclean.startup.input.StartApplicationInput;

public final class DungeoncleanLauncher extends Application {

    private final StartupObject startupObject = new StartupObject();

    @Override
    public void start(Stage primaryStage) {
        startupObject.start(new StartApplicationInput(primaryStage, this::showMainStage, this::notifyPreloader));
    }

    private void showMainStage(ShowMainStageInput input) {
        DungeoncleanObject dungeoncleanObject = new DungeoncleanObject();
        var surface = dungeoncleanObject.loadSurface(new features.world.dungeonclean.input.LoadSurfaceInput());
        ComposeShellInput composeShellInput = new ComposeShellInput(
                surface.title(),
                surface.navigationLabel(),
                surface.controlsContent(),
                surface.mainContent(),
                surface.detailsContent(),
                surface.stateContent());
        javafx.scene.layout.BorderPane shell =
                new AppshellObject(composeShellInput).composeShell(composeShellInput).root();

        Scene scene = new Scene(shell, 1150, 700);
        scene.getStylesheets().add(
                getClass().getResource("/salt-marcher.css").toExternalForm());

        input.primaryStage().setTitle("Salt Marcher");
        input.primaryStage().setScene(scene);
        input.primaryStage().setMinWidth(900);
        input.primaryStage().setMinHeight(500);
        input.primaryStage().show();
    }

    public static void main(String[] args) {
        launch(DungeoncleanLauncher.class, args);
    }
}
