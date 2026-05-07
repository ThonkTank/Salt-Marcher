package src.view.slotcontent.primitives.mapcanvas;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record MapCanvasPolygonPrimitive(
        String hitRef,
        @Nullable String selectionRef,
        int z,
        List<MapCanvasPoint> polygon,
        MapRenderScene.PaintStyle style
) {

    public MapCanvasPolygonPrimitive {
        hitRef = hitRef == null ? "" : hitRef;
        selectionRef = selectionRef == null ? null : selectionRef;
        polygon = polygon == null ? List.of() : List.copyOf(polygon);
        style = style == null ? new MapRenderScene.PaintStyle(null, null, 0.0, 1.0, false) : style;
    }
}
