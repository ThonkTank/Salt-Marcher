package clean.featuretabs.navigationicon.input;

import javafx.scene.Node;

@SuppressWarnings("unused")
public record ComposeNavigationiconInput() {

    public record NavigationiconInput(
            Node catalogGraphic,
            Node travelGraphic,
            Node mapEditorGraphic,
            Node tablesGraphic
    ) {
    }
}
