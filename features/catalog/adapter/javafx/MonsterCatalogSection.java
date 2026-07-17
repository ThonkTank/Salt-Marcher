package features.catalog.adapter.javafx;

import javafx.scene.Node;

final class MonsterCatalogSection implements CatalogSection {

    private final CatalogControlsView controls;
    private final CatalogMainView content;

    MonsterCatalogSection(CatalogControlsView controls, CatalogMainView content) {
        this.controls = controls;
        this.content = content;
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
}
