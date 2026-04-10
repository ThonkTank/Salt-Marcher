package clean.featuretabs.mapeditortab.dungeoneditor.input;

import clean.featuretabs.mapcatalog.input.LoadMapsInput;
import javafx.scene.Node;

public record ComposeDungeoneditorInput(
        LoadMapsInput.MapInput map
) {

    public record DungeoneditorInput(
            Node mainContent
    ) {
    }
}
