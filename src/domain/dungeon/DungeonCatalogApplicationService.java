package src.domain.dungeon;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.usecase.ApplyDungeonMapCatalogUseCase;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapId;

/**
 * Public authored-dungeon backend boundary for map catalog work.
 */
public final class DungeonCatalogApplicationService {

    private final ApplyDungeonMapCatalogUseCase applyDungeonMapCatalogUseCase;
    private final CatalogPublication publication;

    public DungeonCatalogApplicationService(
            ApplyDungeonMapCatalogUseCase applyDungeonMapCatalogUseCase,
            CatalogPublication publication
    ) {
        this.applyDungeonMapCatalogUseCase =
                Objects.requireNonNull(applyDungeonMapCatalogUseCase, "applyDungeonMapCatalogUseCase");
        this.publication = Objects.requireNonNull(publication, "publication");
    }

    public void catalog(DungeonMapCatalogCommand command) {
        DungeonMapCatalogCommand safeCommand = Objects.requireNonNull(command, "command");
        if (safeCommand instanceof DungeonMapCatalogCommand.Search search) {
            publication.publishSearch(applyDungeonMapCatalogUseCase.search(search.query()));
            return;
        }
        if (safeCommand instanceof DungeonMapCatalogCommand.CreateMap createMap) {
            publication.publishCreated(applyDungeonMapCatalogUseCase.createMap(createMap.mapName()));
            return;
        }
        if (safeCommand instanceof DungeonMapCatalogCommand.RenameMap renameMap) {
            publication.publishRenamed(applyDungeonMapCatalogUseCase.renameMap(
                    domainId(renameMap.mapId()),
                    renameMap.mapName()));
            return;
        }
        DeleteDungeonMapCommand deleteMap = (DeleteDungeonMapCommand) safeCommand;
        publication.publishDeleted(applyDungeonMapCatalogUseCase.deleteMap(domainId(deleteMap.mapId())));
    }

    private static DungeonMapIdentity domainId(@Nullable DungeonMapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }

    interface CatalogPublication {

        void publishSearch(ApplyDungeonMapCatalogUseCase.MapCatalogResult result);

        void publishCreated(DungeonMapIdentity mapId);

        void publishRenamed(DungeonMapIdentity mapId);

        void publishDeleted(DungeonMapIdentity mapId);
    }
}
