package src.view.dungeonshared.interactor;

import src.domain.dungeon.api.BaseMapSnapshot;
import src.view.mapshared.Model.MapWorkspaceRenderModel;

import java.util.function.Function;
import java.util.function.Supplier;

public record DungeonMapPresentation(
        Supplier<MapWorkspaceRenderModel> placeholderRenderModel,
        Function<BaseMapSnapshot, MapWorkspaceRenderModel> loadedRenderModel
) {
}
