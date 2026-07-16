package features.scene.adapter.javafx;

import features.scene.api.SceneApi;
import features.scene.api.SceneModel;
import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;

public final class SceneContribution implements ShellContribution {

    private final SceneApi scenes;
    private final SceneModel model;

    public SceneContribution(SceneApi scenes, SceneModel model) {
        this.scenes = Objects.requireNonNull(scenes, "scenes");
        this.model = Objects.requireNonNull(model, "model");
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellLeftBarTabSpec(
                new ContributionKey("runtime-scenes"),
                new NavigationGroupSpec("play", "Spielbetrieb", 5),
                10,
                false,
                NavigationGraphicResource.of("/view/leftbartabs/scene/navigation-icon.svg"),
                ShellLeftBarTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind() {
        return new SceneBinder(scenes, model).bind();
    }
}
