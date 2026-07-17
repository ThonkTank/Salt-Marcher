package features.catalog.adapter.javafx;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import javafx.scene.Node;

/** Typed coordinator for the two shell slots of the Catalog contribution. */
final class CatalogWorkspace {

    private final Map<CatalogSectionId, CatalogSection> sections = new EnumMap<>(CatalogSectionId.class);
    private final CatalogControlsHost controls;
    private final CatalogContentHost content = new CatalogContentHost();
    private CatalogSection active;

    CatalogWorkspace(List<CatalogSection> sections) {
        List<CatalogSection> orderedSections = sections == null ? List.of() : List.copyOf(sections);
        if (orderedSections.isEmpty()) {
            throw new IllegalArgumentException("Catalog requires at least one section.");
        }
        for (CatalogSection section : orderedSections) {
            CatalogSection previous = this.sections.put(section.id(), section);
            if (previous != null) {
                throw new IllegalArgumentException("Duplicate Catalog section: " + section.id());
            }
        }
        controls = new CatalogControlsHost(orderedSections);
        controls.onSectionSelected(this::select);
        select(orderedSections.getFirst().id());
    }

    Node controls() {
        return controls;
    }

    Node content() {
        return content;
    }

    void select(CatalogSectionId id) {
        CatalogSection next = sections.get(id);
        if (next == null || next == active) {
            return;
        }
        if (active != null) {
            active.deactivate();
        }
        active = next;
        controls.show(next);
        content.show(next);
        next.activate();
    }

}
