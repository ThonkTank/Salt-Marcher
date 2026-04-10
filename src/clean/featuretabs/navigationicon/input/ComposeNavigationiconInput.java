package clean.featuretabs.navigationicon.input;

import javafx.scene.Node;

public record ComposeNavigationiconInput() {

    public record NavigationiconInput(
            Node catalogGraphic,
            Node travelGraphic,
            Node mapEditorGraphic,
            Node tablesGraphic
    ) {
    }
}
