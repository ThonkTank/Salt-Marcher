package launcher.dungeonclean;

import features.world.dungeonclean.DungeoncleanObject;
import javafx.application.Application;
import javafx.scene.Scene;
import javafx.stage.Stage;
import launcher.dungeonclean.startup.StartupObject;
import launcher.dungeonclean.startup.input.ShowMainStageInput;
import launcher.dungeonclean.startup.input.StartApplicationInput;
import ui.shell.AppShell;
import ui.shell.ViewId;

public final class DungeoncleanLauncher extends Application {

    private final StartupObject startupObject = new StartupObject();

    @Override
    public void start(Stage primaryStage) {
        startupObject.start(new StartApplicationInput(primaryStage, this::showMainStage, this::notifyPreloader));
    }

    private void showMainStage(ShowMainStageInput input) {
        AppShell shell = new AppShell();
        DungeoncleanObject dungeoncleanObject = new DungeoncleanObject();
        var views = dungeoncleanObject.views(new features.world.dungeonclean.input.ViewsInput(null));

        shell.registerView(ViewId.DUNGEON_EDITOR, views.dungeonCleanView());

        Scene scene = new Scene(shell, 1150, 700);
        scene.getStylesheets().add(
                getClass().getResource("/salt-marcher.css").toExternalForm());

        shell.navigateTo(ViewId.DUNGEON_EDITOR);

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
