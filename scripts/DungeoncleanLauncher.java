import database.DatabaseManager;
import features.world.dungeonclean.DungeoncleanObject;
import javafx.application.Application;
import javafx.application.Platform;
import javafx.scene.Scene;
import javafx.stage.Stage;
import ui.shell.AppShell;
import ui.shell.ViewId;

public final class DungeoncleanLauncher extends Application {

    @Override
    public void start(Stage primaryStage) {
        DatabaseManager.setupDatabase();

        AppShell shell = new AppShell();
        DungeoncleanObject dungeoncleanObject = new DungeoncleanObject();
        var views = dungeoncleanObject.views(new features.world.dungeonclean.input.ViewsInput(null));

        shell.registerView(ViewId.DUNGEON_EDITOR, views.dungeonCleanView());

        Scene scene = new Scene(shell, 1150, 700);
        scene.getStylesheets().add(
                DungeoncleanLauncher.class.getResource("/salt-marcher.css").toExternalForm());

        shell.navigateTo(ViewId.DUNGEON_EDITOR);

        primaryStage.setTitle("Salt Marcher Clean");
        primaryStage.setScene(scene);
        primaryStage.setMinWidth(900);
        primaryStage.setMinHeight(500);
        primaryStage.show();
        Platform.setImplicitExit(true);
    }

    public static void main(String[] args) {
        launch(DungeoncleanLauncher.class, args);
    }
}
