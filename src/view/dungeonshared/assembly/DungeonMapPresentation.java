package src.view.dungeonshared.assembly;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.view.mapshared.api.MapWorkspaceRenderModel;
import java.util.function.Function;
import java.util.function.Supplier;
public record DungeonMapPresentation(
        Supplier<MapWorkspaceRenderModel> placeholderRenderModel,
        Function<BaseMapSnapshot, MapWorkspaceRenderModel> loadedRenderModel
) {
}
