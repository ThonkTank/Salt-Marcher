package src.view.dungeonshared.interactor;

import src.domain.dungeon.api.DungeonInspectorSnapshot;
import src.domain.mapcore.api.MapSelectionRef;

public interface DungeonSelectionPublisher {

    void clear();

    void showSelection(MapSelectionRef selectionRef, DungeonInspectorSnapshot snapshot);
}
