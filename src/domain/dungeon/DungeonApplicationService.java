package src.domain.dungeon;

import src.domain.dungeon.published.BaseMapSnapshot;
import src.domain.dungeon.published.CreateDungeonMapCommand;
import src.domain.dungeon.published.CreateDungeonMapResult;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DeleteDungeonMapResult;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.LoadMapSnapshotQuery;
import src.domain.dungeon.published.SearchMapsQuery;
import src.domain.dungeon.application.DungeonDefaultApplicationServices;

import java.util.List;

/**
 * Public dungeon feature facade used by editor and travel interactors.
 */
public final class DungeonApplicationService {

    public DungeonSnapshot loadSnapshot() {
        return DungeonDefaultApplicationServices.loadSnapshot();
    }

    public DungeonOperationResult applyOperation(DungeonEditorOperation operation) {
        return DungeonDefaultApplicationServices.applyOperation(operation);
    }

    public DungeonInspectorSnapshot describeSelection(String ownerKind, long ownerId) {
        return DungeonDefaultApplicationServices.describeSelection(ownerKind, ownerId);
    }

    public List<DungeonMapSummary> searchMaps(SearchMapsQuery query) {
        return DungeonDefaultApplicationServices.searchMaps(query);
    }

    public CreateDungeonMapResult createMap(CreateDungeonMapCommand command) {
        return DungeonDefaultApplicationServices.createMap(command);
    }

    public DeleteDungeonMapResult deleteMap(DeleteDungeonMapCommand command) {
        return DungeonDefaultApplicationServices.deleteMap(command);
    }

    public BaseMapSnapshot loadMapSnapshot(LoadMapSnapshotQuery query) {
        return DungeonDefaultApplicationServices.loadMapSnapshot(query);
    }

    public void activateMap(DungeonMapId mapId, String mapName) {
        DungeonDefaultApplicationServices.activateMap(mapId, mapName);
    }
}
