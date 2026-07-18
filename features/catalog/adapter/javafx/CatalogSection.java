package features.catalog.adapter.javafx;

import features.catalog.application.CatalogSectionId;
import javafx.scene.Node;

interface CatalogSection {

    CatalogSectionId id();

    Node controls();

    Node content();

    default void activate() {
    }

    default void deactivate() {
    }
}
