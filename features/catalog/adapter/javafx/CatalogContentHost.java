package features.catalog.adapter.javafx;

import javafx.scene.layout.BorderPane;

/** Main-slot host that swaps persistent section roots without rebuilding them. */
final class CatalogContentHost extends BorderPane {

    CatalogContentHost() {
        getStyleClass().add("catalog-content-host");
    }

    void show(CatalogSection section) {
        setCenter(section.content());
    }
}
