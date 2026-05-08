package src.view.slotcontent.primitives.mapcanvas;

import java.util.List;
import javafx.scene.paint.Color;
import org.jspecify.annotations.Nullable;

public record MapRenderScene(
        String title,
        String subtitle,
        String modeLabel,
        String statusLabel,
        String summaryLabel,
        boolean sceneLoaded,
        String overlayMessage,
        ViewMode viewMode,
        List<MapCanvasPolygonPrimitive> surfaces,
        List<BoundaryPrimitive> boundaries,
        List<GlyphPrimitive> glyphs,
        List<TextPrimitive> texts,
        List<RelationPrimitive> relations,
        List<MapCanvasPolygonPrimitive> actors,
        List<OverlayPrimitive> overlays
) {

    public MapRenderScene {
        title = title == null || title.isBlank() ? "Map" : title;
        subtitle = subtitle == null ? "" : subtitle;
        modeLabel = modeLabel == null ? "" : modeLabel;
        statusLabel = statusLabel == null ? "" : statusLabel;
        summaryLabel = summaryLabel == null ? "" : summaryLabel;
        overlayMessage = overlayMessage == null ? "" : overlayMessage;
        viewMode = viewMode == null ? ViewMode.GRID : viewMode;
        surfaces = surfaces == null ? List.of() : List.copyOf(surfaces);
        boundaries = boundaries == null ? List.of() : List.copyOf(boundaries);
        glyphs = glyphs == null ? List.of() : List.copyOf(glyphs);
        texts = texts == null ? List.of() : List.copyOf(texts);
        relations = relations == null ? List.of() : List.copyOf(relations);
        actors = actors == null ? List.of() : List.copyOf(actors);
        overlays = overlays == null ? List.of() : List.copyOf(overlays);
    }

    public static MapRenderScene empty(String title) {
        return new MapRenderScene(
                title,
                "",
                "",
                "",
                "",
                false,
                "No map scene loaded.",
                ViewMode.GRID,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of());
    }

    public enum ViewMode {
        GRID,
        GRAPH
    }

    public record PaintStyle(
            @Nullable Color fill,
            @Nullable Color stroke,
            double strokeWidth,
            double alpha,
            boolean dashed
    ) {

        public PaintStyle {
            strokeWidth = Math.max(0.0, strokeWidth);
            alpha = Math.max(0.0, Math.min(1.0, alpha));
        }

        public static PaintStyle fillOnly(Color fill, double alpha) {
            return new PaintStyle(fill, null, 0.0, alpha, false);
        }
    }

    public record MapCanvasPolygonPrimitive(
            String hitRef,
            String selectionRef,
            int z,
            List<CanvasPointerEvent.MapCanvasPoint> polygon,
            PaintStyle style
    ) {

        public MapCanvasPolygonPrimitive {
            hitRef = hitRef == null ? "" : hitRef;
            selectionRef = selectionRef == null ? "" : selectionRef;
            polygon = polygon == null ? List.of() : List.copyOf(polygon);
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
        }
    }

    public record BoundaryPrimitive(
            String hitRef,
            String selectionRef,
            int z,
            List<CanvasPointerEvent.MapCanvasPoint> polyline,
            PaintStyle style
    ) {

        public BoundaryPrimitive {
            hitRef = hitRef == null ? "" : hitRef;
            selectionRef = selectionRef == null ? "" : selectionRef;
            polyline = polyline == null ? List.of() : List.copyOf(polyline);
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
        }
    }

    public record GlyphPrimitive(
            String hitRef,
            String selectionRef,
            int z,
            List<CanvasPointerEvent.MapCanvasPoint> polygon,
            PaintStyle style,
            String label,
            @Nullable Color labelColor
    ) {

        public GlyphPrimitive {
            hitRef = hitRef == null ? "" : hitRef;
            selectionRef = selectionRef == null ? "" : selectionRef;
            polygon = polygon == null ? List.of() : List.copyOf(polygon);
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
            label = label == null ? "" : label;
            labelColor = labelColor == null ? Color.WHITE : labelColor;
        }
    }

    public record TextPrimitive(
            String hitRef,
            String selectionRef,
            int z,
            String text,
            double centerX,
            double centerY,
            double width,
            double height,
            PaintStyle style,
            @Nullable Color textColor
    ) {

        public TextPrimitive {
            hitRef = hitRef == null ? "" : hitRef;
            selectionRef = selectionRef == null ? "" : selectionRef;
            text = text == null ? "" : text;
            width = Math.max(0.0, width);
            height = Math.max(0.0, height);
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
            textColor = textColor == null ? Color.WHITE : textColor;
        }
    }

    public record RelationPrimitive(
            String hitRef,
            int z,
            List<CanvasPointerEvent.MapCanvasPoint> polyline,
            PaintStyle style
    ) {

        public RelationPrimitive {
            hitRef = hitRef == null ? "" : hitRef;
            polyline = polyline == null ? List.of() : List.copyOf(polyline);
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
        }
    }

    public record OverlayPrimitive(
            String label,
            double centerX,
            double centerY,
            double width,
            double height,
            PaintStyle style,
            @Nullable Color textColor
    ) {

        public OverlayPrimitive {
            label = label == null ? "" : label;
            width = Math.max(0.0, width);
            height = Math.max(0.0, height);
            style = style == null ? new PaintStyle(null, null, 0.0, 1.0, false) : style;
            textColor = textColor == null ? Color.WHITE : textColor;
        }
    }
}
