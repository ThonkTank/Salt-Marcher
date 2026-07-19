package features.catalog.adapter.javafx;

import features.catalog.application.CatalogActiveSection;
import features.catalog.application.CatalogSectionBinding;
import features.catalog.application.CatalogWorkspaceController;
import features.catalog.application.CatalogWorkspaceState;
import java.util.Objects;
import javafx.scene.Node;

/** Passive shell projection of the one complete Catalog renderer. */
final class CatalogWorkspaceView implements CatalogActiveSection.Receiver {

    private final CatalogSectionRenderer renderer;
    private long workspaceRevision;

    CatalogWorkspaceView(CatalogWorkspaceController controller) {
        CatalogWorkspaceController requiredController = Objects.requireNonNull(controller, "controller");
        renderer = new CatalogSectionRenderer(requiredController::selectSection);
    }

    Node controls() { return renderer.controls(); }
    Node content() { return renderer.content(); }

    void apply(CatalogWorkspaceState state) {
        CatalogWorkspaceState requiredState = Objects.requireNonNull(state, "state");
        workspaceRevision = requiredState.revision();
        renderer.selectSection(requiredState.activeSection().id());
        requiredState.activeSection().dispatch(this);
    }

    @Override
    public <Q, R, K> void accept(CatalogSectionBinding<Q, R, K> binding) {
        renderer.render(binding.definition(), CatalogRenderState.from(
                workspaceRevision, binding.state(), binding.actionMessage(), binding.confirmation()),
                binding.commands());
    }
}
