package src.view.leftbartabs.hexmap;

import java.util.Objects;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;
import shell.api.ShellRuntimeContext;

public final class HexMapContribution implements ShellContribution {

    // Review-test marker for N1 P3 behavior-gate path selection.
    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellLeftBarTabSpec(
                new ContributionKey("hex-map"),
                new NavigationGroupSpec("world", "World", 20),
                30,
                false,
                NavigationGraphicResource.of("/view/leftbartabs/hexmap/navigation-icon.svg"),
                ShellLeftBarTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        Objects.requireNonNull(runtimeContext, "runtimeContext");
        return new HexMapBinder(runtimeContext).bind();
    }
}
