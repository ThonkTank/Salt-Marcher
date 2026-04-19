package src.view.dungeonshared.assembly;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.view.mapcanvas.api.MapCanvasRenderModel;
import java.util.function.Function;
import java.util.function.Supplier;
public record DungeonMapPresentation(
        Supplier<MapCanvasRenderModel> placeholderRenderModel,
        Function<BaseMapSnapshot, MapCanvasRenderModel> loadedRenderModel
) {
}
