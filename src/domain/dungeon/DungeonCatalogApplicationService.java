package src.domain.dungeon;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.application.ApplyDungeonMapCatalogUseCase;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.published.DungeonAuthoredReadCommand;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapId;

/**
 * Public authored-dungeon backend boundary for map catalog work.
 */
public final class DungeonCatalogApplicationService {

    private final ApplyDungeonMapCatalogUseCase applyDungeonMapCatalogUseCase;

    public DungeonCatalogApplicationService(ApplyDungeonMapCatalogUseCase applyDungeonMapCatalogUseCase) {
        this.applyDungeonMapCatalogUseCase =
                Objects.requireNonNull(applyDungeonMapCatalogUseCase, "applyDungeonMapCatalogUseCase");
    }

    public void catalog(DungeonMapCatalogCommand command) {
        DungeonMapCatalogCommand safeCommand = Objects.requireNonNull(command, "command");
        if (safeCommand instanceof DungeonMapCatalogCommand.Search search) {
            applyDungeonMapCatalogUseCase.search(search.query());
            return;
        }
        if (safeCommand instanceof DungeonMapCatalogCommand.CreateMap createMap) {
            applyDungeonMapCatalogUseCase.createMap(createMap.mapName());
            return;
        }
        if (safeCommand instanceof DungeonMapCatalogCommand.RenameMap renameMap) {
            applyDungeonMapCatalogUseCase.renameMap(domainId(renameMap.mapId()), renameMap.mapName());
            return;
        }
        DungeonAuthoredReadCommand.MapSelection deleteMap = (DungeonAuthoredReadCommand.MapSelection) safeCommand;
        applyDungeonMapCatalogUseCase.deleteMap(domainId(deleteMap.mapId()));
    }

    private static DungeonMapIdentity domainId(@Nullable DungeonMapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }
}
