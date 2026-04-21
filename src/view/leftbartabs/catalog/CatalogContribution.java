package src.view.leftbartabs.catalog;

import java.util.Objects;
import javafx.scene.Node;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicSupport;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellRuntimeContext;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;

public final class CatalogContribution implements ShellContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public CatalogContribution() {
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellLeftBarTabSpec(
                new ContributionKey("catalog"),
                new NavigationGroupSpec("reference", "Reference", 30),
                10,
                false,
                CatalogContribution::navigationGraphic,
                ShellLeftBarTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind(ShellRuntimeContext runtimeContext) {
        return new CatalogBinder(Objects.requireNonNull(runtimeContext, "runtimeContext")).bind();
    }

    private static Node navigationGraphic() {
        return NavigationGraphicSupport.wrap(
                NavigationGraphicSupport.strokeLine(5, 4, 13, 14),
                NavigationGraphicSupport.strokeLine(13, 4, 5, 14),
                NavigationGraphicSupport.strokeLine(4, 10, 8, 6),
                NavigationGraphicSupport.strokeLine(10, 6, 14, 10));
    }
}
