package features.dungeon.adapter.javafx.map;

import java.util.EnumMap;
import java.util.Map;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.PaintStyle;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.RenderColor;

final class DungeonMapSceneStyles {

    private DungeonMapSceneStyles() {
    }

    static PaintStyle graphLinkStyle(DungeonMapRenderState.GraphLink link) {
        return new PaintStyle(
                null,
                link.selected() ? Palette.HIGHLIGHT_STROKE : Palette.GRAPH_LINK,
                link.selected() ? 2.4 / 32.0 : 1.7 / 32.0,
                1.0,
                false);
    }

    static PaintStyle graphNodeStyle(DungeonMapRenderState.GraphNode node, boolean hovered) {
        return new PaintStyle(
                Palette.GRAPH_NODE_FILL,
                node.selected()
                        ? Palette.HIGHLIGHT_STROKE
                        : hovered ? Palette.HOVER_STROKE : Palette.ROOM_CELL_STROKE,
                node.selected() ? 2.4 / 32.0 : hovered ? 2.0 / 32.0 : 1.2 / 32.0,
                1.0,
                false);
    }

    static RenderColor labelTextColor(DungeonMapRenderState.Label label) {
        if (label != null && label.labelKind() == PreparedLabelKind.ROOM_LABEL) {
            return label.preview()
                    ? Palette.PREVIEW_ROOM_LABEL_TEXT
                    : label.selected()
                    ? Palette.SELECTED_ROOM_LABEL_TEXT
                    : Palette.ROOM_LABEL_TEXT;
        }
        return Palette.LABEL_TEXT;
    }

    static final class Surface {

        private Surface() {
        }

        static PaintStyle style(
                DungeonMapRenderState.Cell cell,
                DungeonMapRenderState displayModel,
                boolean hovered
        ) {
            if (cell.preview()) {
                return previewStyle(cell);
            }
            if (cell.z() != displayModel.projectionLevel()) {
                return overlayStyle(cell, displayModel);
            }
            if (!cell.selected() && hovered) {
                return new PaintStyle(
                        Palette.blend(baseFill(cell), Palette.HOVER_STROKE, 0.18),
                        Palette.HOVER_STROKE,
                        1.8 / 32.0,
                        1.0,
                        false);
            }
            return new PaintStyle(
                    cell.selected() ? Palette.SELECTED_FILL : baseFill(cell),
                    cell.selected() ? Palette.SELECTED_STROKE : baseStroke(cell),
                    cell.selected() ? 2.4 / 32.0 : 1.0 / 32.0,
                    1.0,
                    false);
        }

        private static PaintStyle previewStyle(DungeonMapRenderState.Cell cell) {
            return new PaintStyle(
                    cell.destructivePreview() ? Palette.DESTRUCTIVE_PREVIEW_FILL : Palette.PREVIEW_FILL,
                    cell.destructivePreview() ? Palette.DESTRUCTIVE_PREVIEW_STROKE : Palette.PREVIEW_STROKE,
                    cell.selected() ? 2.4 / 32.0 : 1.0 / 32.0,
                    0.58,
                    false);
        }

        private static PaintStyle overlayStyle(
                DungeonMapRenderState.Cell cell,
                DungeonMapRenderState displayModel
        ) {
            boolean above = cell.z() > displayModel.projectionLevel();
            RenderColor tint = above ? Palette.ABOVE_TINT : Palette.BELOW_TINT;
            RenderColor baseFill = above ? Palette.ROOM_FILL : Palette.CORRIDOR_FILL;
            return new PaintStyle(
                    Palette.blend(baseFill, tint, 0.56),
                    Palette.blend(Palette.ROOM_CELL_STROKE, tint, 0.62),
                    cell.selected() ? 2.4 / 32.0 : 1.0 / 32.0,
                    DungeonMapSceneGeometry.Overlay.overlayAlpha(
                            cell.z(),
                            displayModel.projectionLevel(),
                            displayModel.overlaySettings().opacity()),
                    false);
        }

        private static RenderColor baseFill(DungeonMapRenderState.Cell cell) {
            return switch (cell.kind()) {
                case ROOM -> Palette.ROOM_FILL;
                case CORRIDOR -> Palette.CORRIDOR_FILL;
                case STAIR -> Palette.STAIR_FILL;
                case TRANSITION -> Palette.TRANSITION_FILL;
                case FEATURE_POI -> Palette.FEATURE_POI_FILL;
                case FEATURE_OBJECT -> Palette.FEATURE_OBJECT_FILL;
                case FEATURE_ENCOUNTER -> Palette.FEATURE_ENCOUNTER_FILL;
            };
        }

        private static RenderColor baseStroke(DungeonMapRenderState.Cell cell) {
            return switch (cell.kind()) {
                case ROOM -> Palette.ROOM_CELL_STROKE;
                case CORRIDOR, STAIR -> Palette.CORRIDOR_STROKE;
                case TRANSITION -> Palette.TRANSITION_STROKE;
                case FEATURE_POI -> Palette.FEATURE_POI_STROKE;
                case FEATURE_OBJECT -> Palette.FEATURE_OBJECT_STROKE;
                case FEATURE_ENCOUNTER -> Palette.FEATURE_ENCOUNTER_STROKE;
            };
        }
    }

    static final class Edge {

        private Edge() {
        }

        static PaintStyle style(
                DungeonMapRenderState.Edge edge,
                DungeonMapRenderState displayModel,
                boolean hovered
        ) {
            if (edge.preview()) {
                return new PaintStyle(null, Palette.PREVIEW_STROKE, 2.6 / 32.0, 0.72, true);
            }
            if (edge.z() != displayModel.projectionLevel()) {
                return overlayStyle(edge, displayModel);
            }
            return visibleStyle(edge, hovered);
        }

        private static PaintStyle overlayStyle(
                DungeonMapRenderState.Edge edge,
                DungeonMapRenderState displayModel
        ) {
            return new PaintStyle(
                    null,
                    edge.isDoor() ? Palette.DOOR_STROKE : Palette.WALL_STROKE,
                    edge.isDoor() ? 3.6 / 32.0 : 2.0 / 32.0,
                    DungeonMapSceneGeometry.Overlay.overlayAlpha(
                            edge.z(),
                            displayModel.projectionLevel(),
                            displayModel.overlaySettings().opacity()),
                    false);
        }

        private static PaintStyle visibleStyle(DungeonMapRenderState.Edge edge, boolean hovered) {
            RenderColor stroke = edge.selected()
                    ? Palette.HIGHLIGHT_STROKE
                    : hovered ? Palette.HOVER_STROKE : edge.isDoor() ? Palette.DOOR_STROKE : Palette.WALL_STROKE;
            double strokeWidth = edge.selected()
                    ? selectedStrokeWidth(edge)
                    : hovered ? hoverStrokeWidth(edge) : unselectedStrokeWidth(edge);
            return new PaintStyle(null, stroke, strokeWidth, 1.0, false);
        }

        private static double selectedStrokeWidth(DungeonMapRenderState.Edge edge) {
            return edge.isDoor() ? 4.2 / 32.0 : 2.8 / 32.0;
        }

        private static double unselectedStrokeWidth(DungeonMapRenderState.Edge edge) {
            return edge.isDoor() ? 3.6 / 32.0 : 2.0 / 32.0;
        }

        private static double hoverStrokeWidth(DungeonMapRenderState.Edge edge) {
            return edge.isDoor() ? 3.9 / 32.0 : 2.4 / 32.0;
        }
    }

    static final class Marker {
        private static final Map<DungeonMapRenderState.MarkerKind, RenderColor> MARKER_STROKES = markerStrokes();

        private Marker() {
        }

        static PaintStyle style(
                DungeonMapRenderState.Marker marker,
                DungeonMapRenderState displayModel,
                boolean hovered
        ) {
            if (marker.preview()) {
                return new PaintStyle(
                        Palette.PREVIEW_FILL,
                        Palette.PREVIEW_STROKE,
                        marker.selected() ? 2.2 / 32.0 : 1.4 / 32.0,
                        0.72,
                        false);
            }
            if (marker.isWallRunMarker()) {
                return new PaintStyle(
                        fill(marker),
                        stroke(marker, hovered),
                        marker.selected() ? 1.8 / 32.0 : hovered ? 1.6 / 32.0 : 1.2 / 32.0,
                        marker.z() == displayModel.projectionLevel()
                                ? 0.92
                                : DungeonMapSceneGeometry.Overlay.overlayAlpha(
                                        marker.z(),
                                        displayModel.projectionLevel(),
                                        displayModel.overlaySettings().opacity()) * 0.92,
                        false);
            }
            return new PaintStyle(
                    fill(marker),
                    stroke(marker, hovered),
                    marker.selected() ? 2.2 / 32.0 : hovered ? 1.9 / 32.0 : 1.4 / 32.0,
                    markerAlpha(marker, displayModel, hovered),
                    false);
        }

        private static double markerAlpha(
                DungeonMapRenderState.Marker marker,
                DungeonMapRenderState displayModel,
                boolean hovered
        ) {
            if (marker.isDoorMarker() && !marker.selected() && !hovered) {
                return 0.0;
            }
            return marker.z() == displayModel.projectionLevel()
                    ? 1.0
                    : DungeonMapSceneGeometry.Overlay.overlayAlpha(
                            marker.z(),
                            displayModel.projectionLevel(),
                            displayModel.overlaySettings().opacity());
        }

        private static RenderColor fill(DungeonMapRenderState.Marker marker) {
            return switch (marker.kind()) {
                case DOOR, CLUSTER -> Palette.LABEL_FILL;
                case STAIR -> Palette.STAIR_FILL;
                case TRANSITION -> Palette.TRANSITION_FILL;
                case WAYPOINT -> Palette.PREVIEW_FILL;
                case FEATURE_POI -> Palette.FEATURE_POI_FILL;
                case FEATURE_OBJECT -> Palette.FEATURE_OBJECT_FILL;
                case FEATURE_ENCOUNTER -> Palette.FEATURE_ENCOUNTER_FILL;
            };
        }

        private static RenderColor stroke(DungeonMapRenderState.Marker marker, boolean hovered) {
            if (marker.selected()) {
                return Palette.HIGHLIGHT_STROKE;
            }
            if (hovered) {
                return Palette.HOVER_STROKE;
            }
            return MARKER_STROKES.get(marker.kind());
        }

        private static Map<DungeonMapRenderState.MarkerKind, RenderColor> markerStrokes() {
            Map<DungeonMapRenderState.MarkerKind, RenderColor> strokes =
                    new EnumMap<>(DungeonMapRenderState.MarkerKind.class);
            strokes.put(DungeonMapRenderState.MarkerKind.DOOR, Palette.DOOR_STROKE);
            strokes.put(DungeonMapRenderState.MarkerKind.STAIR, Palette.CORRIDOR_STROKE);
            strokes.put(DungeonMapRenderState.MarkerKind.TRANSITION, Palette.TRANSITION_STROKE);
            strokes.put(DungeonMapRenderState.MarkerKind.WAYPOINT, Palette.PREVIEW_STROKE);
            strokes.put(DungeonMapRenderState.MarkerKind.CLUSTER, Palette.LABEL_BORDER);
            strokes.put(DungeonMapRenderState.MarkerKind.FEATURE_POI, Palette.FEATURE_POI_STROKE);
            strokes.put(DungeonMapRenderState.MarkerKind.FEATURE_OBJECT, Palette.FEATURE_OBJECT_STROKE);
            strokes.put(DungeonMapRenderState.MarkerKind.FEATURE_ENCOUNTER, Palette.FEATURE_ENCOUNTER_STROKE);
            return Map.copyOf(strokes);
        }
    }

    static final class Label {

        private Label() {
        }

        static PaintStyle style(
                DungeonMapRenderState.Label label,
                DungeonMapRenderState displayModel,
                boolean hovered
        ) {
            if (label.labelKind() == PreparedLabelKind.ROOM_LABEL) {
                return roomLabelStyle(label, displayModel);
            }
            return framedLabelStyle(label, displayModel, hovered);
        }

        private static PaintStyle roomLabelStyle(
                DungeonMapRenderState.Label label,
                DungeonMapRenderState displayModel
        ) {
            double labelAlpha = label.preview()
                    ? alpha(label, displayModel) * 0.94
                    : label.selected() ? alpha(label, displayModel) : alpha(label, displayModel) * 0.72;
            return new PaintStyle(
                    null,
                    null,
                    0.0,
                    labelAlpha,
                    false);
        }

        private static PaintStyle framedLabelStyle(
                DungeonMapRenderState.Label label,
                DungeonMapRenderState displayModel,
                boolean hovered
        ) {
            return new PaintStyle(
                    label.preview() ? Palette.PREVIEW_FILL : Palette.LABEL_FILL,
                    label.preview()
                            ? Palette.PREVIEW_STROKE
                            : label.selected()
                            ? Palette.HIGHLIGHT_STROKE
                            : hovered ? Palette.HOVER_STROKE : Palette.LABEL_BORDER,
                    (label.selected() ? 2.0 : hovered ? 1.6 : 1.0) / 32.0,
                    alpha(label, displayModel),
                    false);
        }

        private static double alpha(
                DungeonMapRenderState.Label label,
                DungeonMapRenderState displayModel
        ) {
            if (label.z() != displayModel.projectionLevel()) {
                return DungeonMapSceneGeometry.Overlay.overlayAlpha(
                        label.z(),
                        displayModel.projectionLevel(),
                        displayModel.overlaySettings().opacity());
            }
            return label.preview() ? 0.76 : 1.0;
        }
    }

    static final class HoverOverlay {

        private HoverOverlay() {
        }

        static PaintStyle cell() {
            return new PaintStyle(
                    Palette.blend(Palette.ROOM_FILL, Palette.HOVER_STROKE, 0.38),
                    Palette.HOVER_STROKE,
                    1.9 / 32.0,
                    0.68,
                    false);
        }

        static PaintStyle boundary() {
            return new PaintStyle(
                    null,
                    Palette.HOVER_STROKE,
                    2.7 / 32.0,
                    0.94,
                    false);
        }

        static PaintStyle vertex() {
            return new PaintStyle(
                    Palette.PREVIEW_FILL,
                    Palette.HOVER_STROKE,
                    1.7 / 32.0,
                    0.92,
                    false);
        }
    }

    static final class Palette {

        static final RenderColor ROOM_FILL = color(0x2a, 0x32, 0x38, 1.0);
        static final RenderColor ROOM_CELL_STROKE = color(0x6d, 0x78, 0x81, 0.72);
        static final RenderColor WALL_STROKE = color(0x8a, 0x6a, 0x35, 1.0);
        static final RenderColor HIGHLIGHT_STROKE = color(0xf1, 0xd3, 0x8a, 1.0);
        static final RenderColor HOVER_STROKE = color(0x9d, 0xe9, 0xff, 0.96);
        static final RenderColor CORRIDOR_FILL = color(0x3b, 0x50, 0x53, 0.8);
        static final RenderColor CORRIDOR_STROKE = color(0x91, 0xb6, 0xb0, 1.0);
        static final RenderColor SELECTED_FILL = color(0x58, 0x70, 0x6e, 0.95);
        static final RenderColor SELECTED_STROKE = color(0xd7, 0xec, 0xe7, 1.0);
        static final RenderColor PREVIEW_FILL = color(0xd7, 0xec, 0xe7, 0.72);
        static final RenderColor PREVIEW_STROKE = color(0xf1, 0xd3, 0x8a, 1.0);
        static final RenderColor PARTY_FILL = color(0xff, 0xb6, 0x2a, 1.0);
        static final RenderColor PARTY_STROKE = color(0xff, 0xf0, 0xc6, 1.0);
        static final RenderColor LABEL_FILL = color(0x18, 0x1f, 0x24, 1.0);
        static final RenderColor LABEL_BORDER = color(0x76, 0x84, 0x8d, 1.0);
        static final RenderColor LABEL_TEXT = color(0xf2, 0xf4, 0xf5, 1.0);
        static final RenderColor ROOM_LABEL_TEXT = color(0x93, 0x9d, 0xa5, 0.82);
        static final RenderColor SELECTED_ROOM_LABEL_TEXT = color(0xe8, 0xee, 0xf2, 1.0);
        static final RenderColor PREVIEW_ROOM_LABEL_TEXT = color(0x24, 0x32, 0x36, 0.94);
        static final RenderColor STAIR_FILL = color(0x4b, 0x3a, 0x6e, 0.95);
        static final RenderColor TRANSITION_FILL = color(0x6f, 0x3f, 0x28, 0.95);
        static final RenderColor TRANSITION_STROKE = color(0xe0, 0xa3, 0x6a, 1.0);
        static final RenderColor FEATURE_POI_FILL = color(0x2f, 0x65, 0x4d, 0.95);
        static final RenderColor FEATURE_POI_STROKE = color(0xa8, 0xde, 0xbf, 1.0);
        static final RenderColor FEATURE_OBJECT_FILL = color(0x6a, 0x53, 0x24, 0.95);
        static final RenderColor FEATURE_OBJECT_STROKE = color(0xf0, 0xce, 0x88, 1.0);
        static final RenderColor FEATURE_ENCOUNTER_FILL = color(0x6c, 0x2f, 0x3d, 0.95);
        static final RenderColor FEATURE_ENCOUNTER_STROKE = color(0xf0, 0xb0, 0xbe, 1.0);
        static final RenderColor DOOR_STROKE = color(0xc6, 0xe2, 0xff, 1.0);
        static final RenderColor GRAPH_LINK = color(0x88, 0x96, 0xa1, 0.9);
        static final RenderColor GRAPH_NODE_FILL = color(0x21, 0x29, 0x2f, 1.0);
        static final RenderColor ABOVE_TINT = color(0x86, 0x90, 0xd8, 0.75);
        static final RenderColor BELOW_TINT = color(0x55, 0x8a, 0x9c, 0.75);
        static final RenderColor DESTRUCTIVE_PREVIEW_FILL = color(0x99, 0x43, 0x3d, 1.0);
        static final RenderColor DESTRUCTIVE_PREVIEW_STROKE = color(0xff, 0xc1, 0x87, 1.0);

        private Palette() {
        }

        static RenderColor blend(RenderColor base, RenderColor tint, double weight) {
            return RenderColor.blend(base, tint, weight);
        }

        private static RenderColor color(int red, int green, int blue, double opacity) {
            return RenderColor.color(red, green, blue, opacity);
        }
    }
}
