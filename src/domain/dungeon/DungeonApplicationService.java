package src.domain.dungeon;

import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.dungeon.api.CreateDungeonMapCommand;
import src.domain.dungeon.api.CreateDungeonMapResult;
import src.domain.dungeon.api.DeleteDungeonMapCommand;
import src.domain.dungeon.api.DeleteDungeonMapResult;
import src.domain.dungeon.api.DungeonEditorOperation;
import src.domain.dungeon.api.DungeonInspectorSnapshot;
import src.domain.dungeon.api.DungeonMapId;
import src.domain.dungeon.api.DungeonMapSummary;
import src.domain.dungeon.api.DungeonOperationResult;
import src.domain.dungeon.api.DungeonSnapshot;
import src.domain.dungeon.api.LoadMapSnapshotQuery;
import src.domain.dungeon.api.SearchMapsQuery;
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
