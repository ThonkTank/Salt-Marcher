package features.catalog.adapter.javafx;

import features.catalog.application.CatalogSectionId;
import features.catalog.application.CatalogWorkspaceController;
import features.catalog.application.CatalogWorkspaceState;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;

/** Passive host that keeps all section roots alive while rendering application-owned workspace state. */
final class CatalogWorkspaceView {

    private final Map<CatalogSectionId, CatalogSection> sections = new EnumMap<>(CatalogSectionId.class);
    private final CatalogControlsHost controls;
    private final CatalogContentHost content = new CatalogContentHost();
    private CatalogSection shown;

    CatalogWorkspaceView(CatalogWorkspaceController controller, List<CatalogSection> sections) {
        CatalogWorkspaceController requiredController = Objects.requireNonNull(controller, "controller");
        List<CatalogSection> ordered = List.copyOf(Objects.requireNonNull(sections, "sections"));
        if (ordered.isEmpty()) {
            throw new IllegalArgumentException("Catalog requires at least one section.");
        }
        for (CatalogSection section : ordered) {
            CatalogSection previous = this.sections.put(section.id(), section);
            if (previous != null) {
                throw new IllegalArgumentException("Duplicate Catalog section: " + section.id());
            }
        }
        controls = new CatalogControlsHost(ordered, requiredController::selectSection);
    }

    Node controls() {
        return controls;
    }

    Node content() {
        return content;
    }

    void apply(CatalogWorkspaceState state) {
        CatalogSection next = sections.get(state.activeSection());
        if (next == null || next == shown) {
            return;
        }
        shown = next;
        controls.show(next);
        content.show(next);
    }
}
