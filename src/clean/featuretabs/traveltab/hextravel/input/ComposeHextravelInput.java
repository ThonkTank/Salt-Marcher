package clean.featuretabs.traveltab.hextravel.input;

import clean.featuretabs.mapcatalog.input.LoadMapsInput;
import javafx.scene.Node;

public record ComposeHextravelInput(
        LoadMapsInput.MapInput map
) {

    public record HextravelInput(
            Node mainContent
    ) {
    }
}
