package src.view.leftbartabs.scene;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;
import src.domain.scene.SceneServiceAssembly;

public final class SceneContribution implements ShellContribution {
    private final SceneServiceAssembly scenes;

    public SceneContribution(SceneServiceAssembly scenes) {
        this.scenes = Objects.requireNonNull(scenes, "scenes");
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
        return new SceneBinder(scenes).bind();
    }
}
