package features.catalog.adapter.javafx;

import features.catalog.application.CatalogWorkspaceBinding;
import features.catalog.application.CatalogWorkspaceController;
import features.catalog.application.CatalogWorkspaceState;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import shell.api.ContributionKey;
import shell.api.NavigationGraphicResource;
import shell.api.NavigationGroupSpec;
import shell.api.ShellBinding;
import shell.api.ShellContribution;
import shell.api.ShellContributionSpec;
import shell.api.ShellLeftBarTabMode;
import shell.api.ShellLeftBarTabSpec;
import shell.api.ShellSlot;

/** Passive Catalog host with one generic renderer for all seven typed definitions. */
public final class CatalogContribution implements ShellContribution, AutoCloseable {

    private final CatalogWorkspaceController controller;
    private final CatalogWorkspaceBinding binding;
    private final AtomicBoolean closed = new AtomicBoolean();
    private CatalogWorkspaceView workspace;
    private long renderedWorkspaceRevision = -1L;

    public CatalogContribution(
            CatalogWorkspaceController controller,
            CatalogWorkspaceBinding binding
    ) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.binding = Objects.requireNonNull(binding, "binding");
    }

    @Override
    public ShellContributionSpec registrationSpec() {
        return new ShellLeftBarTabSpec(
                new ContributionKey("catalog"),
                new NavigationGroupSpec("reference", "Reference", 30),
                10, false,
                NavigationGraphicResource.of("/view/leftbartabs/catalog/navigation-icon.svg"),
                ShellLeftBarTabMode.RUNTIME);
    }

    @Override
    public ShellBinding bind() {
        if (closed.get()) {
            throw new IllegalStateException("Catalog contribution is closed.");
        }
        if (workspace != null) {
            throw new IllegalStateException("Catalog contribution may only be bound once.");
        }
        workspace = new CatalogWorkspaceView(controller);
        binding.attach(this::apply);
        return new CatalogShellBinding(workspace);
    }

    private void apply(CatalogWorkspaceState state) {
        if (workspace == null || closed.get() || state.revision() <= renderedWorkspaceRevision) {
            return;
        }
        renderedWorkspaceRevision = state.revision();
        workspace.apply(state);
    }

    @Override public void close() {
        closed.set(true);
    }

    private final class CatalogShellBinding implements ShellBinding {
        private final Map<ShellSlot, javafx.scene.Node> slots;

        private CatalogShellBinding(CatalogWorkspaceView view) {
            slots = Map.of(ShellSlot.COCKPIT_MAIN, view.content());
        }

        @Override public String title() { return "Katalog"; }
        @Override public Map<ShellSlot, javafx.scene.Node> slotContent() { return slots; }
        @Override public void onActivate() { controller.activate(); }
        @Override public void onDeactivate() { controller.deactivate(); }
    }
}
