package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

final class DungeonMapHitAreaProjector {
    private static final String CLUSTER_LABEL_KIND = "CLUSTER_LABEL";

    private DungeonMapHitAreaProjector() {
    }

    static List<DungeonMapHitAreaIndex.HitArea> project(
            DungeonMapSceneAssembler.SceneBuckets buckets,
            DungeonMapRenderState displayModel
    ) {
        if (displayModel != null && displayModel.isGraphView()) {
            return graphHitAreas(buckets.texts(), buckets.relations(), buckets.surfaces());
        }
        return gridHitAreas(
                buckets.actors(),
                buckets.glyphs(),
                buckets.texts(),
                buckets.boundaries(),
                buckets.surfaces(),
                displayModel);
    }

    private static List<DungeonMapHitAreaIndex.HitArea> gridHitAreas(
            List<DungeonMapContentModel.MapCanvasPolygonPrimitive> actors,
            List<DungeonMapContentModel.GlyphPrimitive> glyphs,
            List<DungeonMapContentModel.TextPrimitive> texts,
            List<DungeonMapContentModel.BoundaryPrimitive> boundaries,
            List<DungeonMapContentModel.MapCanvasPolygonPrimitive> surfaces,
            DungeonMapRenderState displayModel
    ) {
        List<DungeonMapHitAreaIndex.HitArea> hitAreas = new ArrayList<>();
        addPolygonHits(hitAreas, actors, DungeonMapContentModel.MapCanvasPolygonPrimitive::hitRef, DungeonMapContentModel.MapCanvasPolygonPrimitive::polygon);
        addPolygonHits(hitAreas, glyphs, DungeonMapContentModel.GlyphPrimitive::hitRef, DungeonMapContentModel.GlyphPrimitive::polygon);
        addTextHits(hitAreas, texts);
        addPolylineHits(hitAreas, boundaries, DungeonMapContentModel.BoundaryPrimitive::hitRef, DungeonMapContentModel.BoundaryPrimitive::polyline);
        hitAreas.addAll(DungeonMapHitAreaIndex.doorHandleHits(displayModel));
        addPolygonHits(hitAreas, surfaces, DungeonMapContentModel.MapCanvasPolygonPrimitive::hitRef, DungeonMapContentModel.MapCanvasPolygonPrimitive::polygon);
        return List.copyOf(hitAreas);
    }

    private static List<DungeonMapHitAreaIndex.HitArea> graphHitAreas(
            List<DungeonMapContentModel.TextPrimitive> texts,
            List<DungeonMapContentModel.RelationPrimitive> relations,
            List<DungeonMapContentModel.MapCanvasPolygonPrimitive> surfaces
    ) {
        List<DungeonMapHitAreaIndex.HitArea> hitAreas = new ArrayList<>();
        addTextHits(hitAreas, texts);
        addPolylineHits(hitAreas, relations, DungeonMapContentModel.RelationPrimitive::hitRef, DungeonMapContentModel.RelationPrimitive::polyline);
        addPolygonHits(hitAreas, surfaces, DungeonMapContentModel.MapCanvasPolygonPrimitive::hitRef, DungeonMapContentModel.MapCanvasPolygonPrimitive::polygon);
        return List.copyOf(hitAreas);
    }

    private static <T> void addPolygonHits(
            List<DungeonMapHitAreaIndex.HitArea> target,
            List<T> source,
            Function<T, String> hitRefReader,
            Function<T, List<DungeonMapContentModel.MapCanvasPoint>> polygonReader
    ) {
        for (T item : source) {
            String hitRef = hitRefReader.apply(item);
            List<DungeonMapContentModel.MapCanvasPoint> polygon = polygonReader.apply(item);
            if (hitRef.isBlank() || polygon.isEmpty()) {
                continue;
            }
            target.add(DungeonMapHitAreaIndex.polygonArea(hitRef, polygon));
        }
    }

    private static <T> void addPolylineHits(
            List<DungeonMapHitAreaIndex.HitArea> target,
            List<T> source,
            Function<T, String> hitRefReader,
            Function<T, List<DungeonMapContentModel.MapCanvasPoint>> polylineReader
    ) {
        for (T item : source) {
            String hitRef = hitRefReader.apply(item);
            List<DungeonMapContentModel.MapCanvasPoint> polyline = polylineReader.apply(item);
            if (hitRef.isBlank() || polyline.isEmpty()) {
                continue;
            }
            target.add(DungeonMapHitAreaIndex.polylineArea(hitRef, polyline));
        }
    }

    private static void addTextHits(
            List<DungeonMapHitAreaIndex.HitArea> target,
            List<DungeonMapContentModel.TextPrimitive> texts
    ) {
        for (DungeonMapContentModel.TextPrimitive text : texts) {
            if (clusterLabelText(text)) {
                addTextHit(target, text);
            }
        }
        for (DungeonMapContentModel.TextPrimitive text : texts) {
            if (!clusterLabelText(text)) {
                addTextHit(target, text);
            }
        }
    }

    private static void addTextHit(List<DungeonMapHitAreaIndex.HitArea> target, DungeonMapContentModel.TextPrimitive text) {
        if (text.hitRef().isBlank() || text.text().isBlank()) {
            return;
        }
        target.add(DungeonMapHitAreaIndex.polygonArea(
                text.hitRef(),
                DungeonMapSceneGeometry.rotatedCenteredRect(
                        text.centerX(),
                        text.centerY(),
                        text.width(),
                        text.height(),
                        text.rotationDegrees())));
    }

    private static boolean clusterLabelText(DungeonMapContentModel.TextPrimitive text) {
        return text != null && text.hitRef().endsWith(":" + CLUSTER_LABEL_KIND);
    }

}
