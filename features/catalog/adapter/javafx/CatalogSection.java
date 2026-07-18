package features.catalog.adapter.javafx;

import features.catalog.application.CatalogSectionId;
public interface CatalogSection {

    CatalogSectionId id();

    CatalogControlsScaffold controls();

    javafx.scene.Node content();
}
