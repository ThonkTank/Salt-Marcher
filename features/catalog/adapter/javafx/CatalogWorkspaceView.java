package features.catalog.adapter.javafx;

import features.catalog.application.CatalogSectionId;
import features.catalog.application.CatalogWorkspaceController;
import features.catalog.application.CatalogWorkspaceState;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import javafx.scene.Node;

/** Persistent legacy section host driven by the application-owned workspace state. */
final class CatalogWorkspaceView {

    private final Map<CatalogSectionId, CatalogSection> sections = new EnumMap<>(CatalogSectionId.class);
    private final CatalogWorkspaceController controller;
    private final CatalogControlsHost controls;
    private final CatalogContentHost content = new CatalogContentHost();
    private CatalogSection shown;
    private boolean active;

    CatalogWorkspaceView(CatalogWorkspaceController controller, List<CatalogSection> sections) {
        this.controller = Objects.requireNonNull(controller, "controller");
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
        controls = new CatalogControlsHost(ordered);
        controls.onSectionSelected(controller::selectSection);
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
        if (active && shown != null) {
            shown.deactivate();
        }
        shown = next;
        controls.show(next);
        content.show(next);
        if (active) {
            shown.activate();
        }
    }

    void activate() {
        if (active) {
            return;
        }
        active = true;
        if (shown != null) {
            shown.activate();
        }
    }

    void deactivate() {
        if (!active) {
            return;
        }
        active = false;
        if (shown != null) {
            shown.deactivate();
        }
    }
}
