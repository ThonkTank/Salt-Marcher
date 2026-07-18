package features.catalog.adapter.javafx;

import features.catalog.application.CatalogSectionId;
import javafx.scene.Node;

public interface CatalogSection {

    CatalogSectionId id();

    Node controls();

    Node content();
}
