package clean.featuretabs.traveltab.dungeontravel.input;

import clean.featuretabs.mapcatalog.input.LoadMapsInput;
import javafx.scene.Node;

@SuppressWarnings("unused")
public record ComposeDungeontravelInput(
        LoadMapsInput.MapInput map
) {

    public record DungeontravelInput(
            Node mainContent
    ) {
    }
}
