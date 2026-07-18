package features.catalog.adapter.javafx;

import features.catalog.application.CatalogSectionId;
import java.util.Objects;
import javafx.scene.Node;

final class MonsterCatalogSection implements CatalogSection {

    private final CatalogControlsView controls;
    private final CatalogMainView content;
    private final Runnable initialize;
    private boolean active;

    MonsterCatalogSection(CatalogControlsView controls, CatalogMainView content, Runnable initialize) {
        this.controls = Objects.requireNonNull(controls, "controls");
        this.content = Objects.requireNonNull(content, "content");
        this.initialize = Objects.requireNonNull(initialize, "initialize");
    }

    @Override
    public CatalogSectionId id() {
        return CatalogSectionId.MONSTERS;
    }

    @Override
    public Node controls() {
        return controls;
    }

    @Override
    public Node content() {
        return content;
    }

    @Override
    public void activate() {
        if (active) {
            return;
        }
        active = true;
        initialize.run();
    }

    @Override
    public void deactivate() {
        active = false;
    }
}
