package clean.featuretabs.mapeditortab.hexeditor.input;

import clean.featuretabs.mapcatalog.input.LoadMapsInput;
import javafx.scene.Node;

public record ComposeHexeditorInput(
        LoadMapsInput.MapInput map
) {

    public record HexeditorInput(
            Node mainContent
    ) {
    }
}
