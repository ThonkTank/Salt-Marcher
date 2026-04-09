package launcher.dungeonclean;

import features.appshell.AppshellObject;
import features.appshell.async.AsyncObject;
import features.appshell.async.input.ComposeAsyncInput;
import features.appshell.inspector.InspectorObject;
import features.appshell.inspector.input.ComposeInspectorInput;
import features.appshell.input.ComposeShellInput;
import features.appshell.scene.SceneObject;
import features.appshell.scene.input.ComposeSceneInput;
import features.world.dungeonclean.DungeoncleanObject;
import javafx.application.Application;
import javafx.scene.Scene;
import javafx.stage.Stage;
import launcher.dungeonclean.startup.StartupObject;
import launcher.dungeonclean.startup.input.ShowMainStageInput;
import launcher.dungeonclean.startup.input.StartApplicationInput;

public final class DungeoncleanLauncher extends Application {

    private final ComposeAsyncInput composeAsyncInput = new ComposeAsyncInput();
    private final ComposeAsyncInput.AsyncInput async =
            new AsyncObject(composeAsyncInput).composeAsync(composeAsyncInput);
    private final StartupObject startupObject = new StartupObject(async);

    @Override
    public void start(Stage primaryStage) {
        startupObject.start(new StartApplicationInput(primaryStage, this::showMainStage, this::notifyPreloader));
    }

    private void showMainStage(ShowMainStageInput input) {
        ComposeInspectorInput composeInspectorInput = new ComposeInspectorInput();
        ComposeInspectorInput.InspectorInput inspector =
                new InspectorObject(composeInspectorInput).composeInspector(composeInspectorInput);
        ComposeSceneInput composeSceneInput = new ComposeSceneInput();
        ComposeSceneInput.SceneInput shellScene =
                new SceneObject(composeSceneInput).composeScene(composeSceneInput);
        features.world.dungeonclean.input.LoadSurfaceInput loadSurfaceInput =
                new features.world.dungeonclean.input.LoadSurfaceInput(
                        info -> inspector.navigator().showInfo().accept(new ComposeInspectorInput.InfoEntryInput(
                                info.title(),
                                info.entryKey(),
                                info.message())),
                        hosted -> inspector.navigator().showContent().accept(new ComposeInspectorInput.HostedEntryInput(
                                hosted.title(),
                                hosted.entryKey(),
                                hosted.contentSupplier())),
                        inspector.navigator().clear(),
                        inspector.navigator().isShowing(),
                        registration -> {
                            ComposeSceneInput.HandleInput handle = shellScene.registry().registerScene().apply(
                                    new ComposeSceneInput.RegistrationInput(
                                            registration.label(),
                                            registration.initialContent()));
                            return new features.world.dungeonclean.input.LoadSurfaceInput.SceneHandleInput(
                                    handle.setContent(),
                                    handle.activate());
                        },
                        task -> async.submitBackground().accept(new ComposeAsyncInput.SubmitBackgroundInput(
                                task.operationName(),
                                task.work(),
                                task.onSuccess(),
                                task.onFailure(),
                                task.onCancelled())));
        DungeoncleanObject dungeoncleanObject = new DungeoncleanObject(loadSurfaceInput);
        var surface = dungeoncleanObject.loadSurface(loadSurfaceInput);
        ComposeShellInput composeShellInput = new ComposeShellInput(
                java.util.List.of(new ComposeShellInput.SurfaceInput(
                        surface.surfaceId(),
                        surface.title(),
                        surface.navigationLabel(),
                        surface.toolbarContent(),
                        surface.controlsContent(),
                        surface.mainContent(),
                        surface.detailsContent(),
                        surface.stateContent(),
                        surface.onShow(),
                        surface.onHide())),
                surface.surfaceId(),
                inspector.detailsContent(),
                shellScene.stateContent());
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
