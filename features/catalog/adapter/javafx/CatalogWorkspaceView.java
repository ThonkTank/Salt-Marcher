package features.catalog.adapter.javafx;

import features.catalog.application.CatalogSectionDefinition;
import features.catalog.application.CatalogWorkspaceController;
import features.catalog.application.CatalogWorkspaceState;
import java.util.Objects;
import javafx.scene.Node;

/** Passive shell projection of the one complete Catalog renderer. */
final class CatalogWorkspaceView {

    private final CatalogSectionRenderer renderer;

    CatalogWorkspaceView(CatalogWorkspaceController controller) {
        CatalogWorkspaceController requiredController = Objects.requireNonNull(controller, "controller");
        renderer = new CatalogSectionRenderer(requiredController::selectSection);
    }

    Node controls() { return renderer.controls(); }
    Node content() { return renderer.content(); }

    void apply(CatalogWorkspaceState state) {
        renderer.selectSection(Objects.requireNonNull(state, "state").activeSection());
    }

    <Q, R, K> void render(
            CatalogSectionDefinition<Q, R, K> definition,
            CatalogRenderState<Q, R, K> state,
            CatalogSectionCommands<Q, K> commands
    ) {
        renderer.render(definition, state, commands);
    }
}
