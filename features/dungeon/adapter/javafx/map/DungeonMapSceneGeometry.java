package features.dungeon.adapter.javafx.map;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.LabelTypography;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.MapCanvasPoint;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel.RenderColor;

final class DungeonMapSceneGeometry {
    private static final double ROTATION_EPSILON = 0.000_001;

    private DungeonMapSceneGeometry() {
    }

    static List<MapCanvasPoint> square(double q, double r, double size) {
        return List.of(
                new MapCanvasPoint(q, r),
                new MapCanvasPoint(q + size, r),
                new MapCanvasPoint(q + size, r + size),
                new MapCanvasPoint(q, r + size));
    }

    static List<MapCanvasPoint> roundedRect(
            double centerQ,
            double centerR,
            double width,
            double height
    ) {
        double halfWidth = width / 2.0;
        double halfHeight = height / 2.0;
        return List.of(
                new MapCanvasPoint(centerQ - halfWidth, centerR - halfHeight),
                new MapCanvasPoint(centerQ + halfWidth, centerR - halfHeight),
                new MapCanvasPoint(centerQ + halfWidth, centerR + halfHeight),
                new MapCanvasPoint(centerQ - halfWidth, centerR + halfHeight));
    }

    static List<MapCanvasPoint> centeredRect(
            double centerQ,
            double centerR,
            double width,
            double height
    ) {
        return roundedRect(centerQ, centerR, width, height);
    }

    static List<MapCanvasPoint> rotatedCenteredRect(
            double centerQ,
            double centerR,
            double width,
            double height,
            double rotationDegrees
    ) {
        List<MapCanvasPoint> points = centeredRect(centerQ, centerR, width, height);
        if (Math.abs(rotationDegrees) < ROTATION_EPSILON) {
            return points;
        }
        double radians = Math.toRadians(rotationDegrees);
        double sin = Math.sin(radians);
        double cos = Math.cos(radians);
        List<MapCanvasPoint> rotated = new ArrayList<>(points.size());
        for (MapCanvasPoint point : points) {
            double deltaQ = point.x() - centerQ;
            double deltaR = point.y() - centerR;
            rotated.add(new MapCanvasPoint(
                    centerQ + deltaQ * cos - deltaR * sin,
                    centerR + deltaQ * sin + deltaR * cos));
        }
        return List.copyOf(rotated);
    }

    static final class Label {
        private static final double ROOM_LABEL_MIN_WIDTH_SCENE = 48.0 / 32.0;
        private static final double ROOM_LABEL_MAX_HEIGHT_SCENE = 1.05;
        private static final double ROOM_LABEL_FONT_MIN_PIXELS = 12.0;
        private static final double ROOM_LABEL_FONT_MAX_PIXELS = 28.0;
        private static final double ROOM_LABEL_WIDTH_TO_FONT_RATIO = 1.55;

        private Label() {
        }

        static double labelHeightScene() {
            return 24.0 / 32.0;
        }

        static double labelHeightScene(DungeonMapRenderState.Label label) {
            if (label == null || label.labelKind() != PreparedLabelKind.ROOM_LABEL) {
                return labelHeightScene();
            }
            double fontSceneHeight = typography(label).fontSizePixels()
                    / DungeonMapViewportScale.baseGrid();
            return Math.max(labelHeightScene(), Math.min(ROOM_LABEL_MAX_HEIGHT_SCENE, fontSceneHeight * 1.35));
        }

        static double labelWidthScene(String label) {
            return Math.max(
                    56.0 / 32.0,
                    Math.min(180.0 / 32.0, label.length() * labelCharWidthScene() + labelPaddingScene()));
        }

        static double labelWidthScene(DungeonMapRenderState.Label label) {
            if (label != null
                    && label.labelKind() == PreparedLabelKind.ROOM_LABEL
                    && label.availableWidthScene() > 0.0) {
                return Math.max(ROOM_LABEL_MIN_WIDTH_SCENE, label.availableWidthScene());
            }
            return labelWidthScene(renderText(label));
        }

        static LabelTypography typography(DungeonMapRenderState.Label label) {
            if (label == null || label.labelKind() != PreparedLabelKind.ROOM_LABEL) {
                return LabelTypography.mapLabel();
            }
            int glyphCount = Math.max(1, renderText(label).length());
            double availablePixels = labelWidthScene(label) * DungeonMapViewportScale.baseGrid();
            double fontSize = Math.max(
                    ROOM_LABEL_FONT_MIN_PIXELS,
                    Math.min(
                            ROOM_LABEL_FONT_MAX_PIXELS,
                            availablePixels / glyphCount * ROOM_LABEL_WIDTH_TO_FONT_RATIO));
            return LabelTypography.roomLabel(fontSize);
        }

        static RenderColor textColor(DungeonMapRenderState.Label label) {
            return DungeonMapSceneStyles.labelTextColor(label);
        }

        static String renderText(DungeonMapRenderState.Label label) {
            if (label == null) {
                return "";
            }
            if (label.labelKind() == PreparedLabelKind.ROOM_LABEL) {
                return label.label().toUpperCase(Locale.ROOT);
            }
            return label.label();
        }

        static String abbreviateLabel(String label, int maxLength) {
            if (label == null || label.length() <= maxLength) {
                return label == null ? "" : label;
            }
            return label.substring(0, Math.max(1, maxLength - 1)) + ".";
        }

        private static double labelPaddingScene() {
            return 16.0 / 32.0;
        }

        private static double labelCharWidthScene() {
            return 7.2 / 32.0;
        }
    }

    static final class Marker {

        private Marker() {
        }

        static List<MapCanvasPoint> markerShape(DungeonMapRenderState.Marker marker) {
            if (marker.isClusterCornerMarker()) {
                return circle(marker.q(), marker.r(), 0.16, 16);
            }
            if (marker.isTransitionMarker()) {
                return marker.sourceEdge() == null
                        ? MarkerSimpleGeometry.diamond(marker.q(), marker.r(), 0.22)
                        : MarkerPillGeometry.transitionEdgePill(marker);
            }
            if (marker.isWallRunMarker() || marker.isDoorMarker()) {
                return MarkerPillGeometry.handlePill(marker);
            }
            double half = markerHalfSizeScene(marker);
            return square(marker.q() - half, marker.r() - half, half * 2.0);
        }

        static List<MapCanvasPoint> doorHandleHitShape(DungeonMapRenderState.Marker marker) {
            return MarkerPillGeometry.doorHandleHitShape(marker);
        }

        static String markerText(DungeonMapRenderState.Marker marker) {
            if (marker.isClusterCornerMarker()
                    || marker.isWallRunMarker()
                    || marker.isDoorMarker()
                    || marker.isTransitionMarker()) {
                return "";
            }
            return Label.abbreviateLabel(marker.label(), marker.isDoorMarker() ? 1 : 3);
        }

        static List<MapCanvasPoint> circle(double centerQ, double centerR, double radius, int points) {
            return MarkerSimpleGeometry.circle(centerQ, centerR, radius, points);
        }

        static List<MapCanvasPoint> partyTokenShape(DungeonMapRenderState.PartyToken token) {
            return PartyTokenGeometry.partyTokenShape(token);
        }

        private static double markerHalfSizeScene() {
            return 0.34;
        }

        private static double markerHalfSizeScene(DungeonMapRenderState.Marker marker) {
            if (marker.isWallRunMarker()) {
                return 0.16;
            }
            return marker.isDoorMarker() ? 0.28 : markerHalfSizeScene();
        }
    }

    static final class Overlay {

        private Overlay() {
        }

        static double overlayAlpha(int z, int projectionLevel, double configuredOpacity) {
            int distance = Math.max(1, Math.abs(z - projectionLevel));
            return Math.max(0.05, Math.min(0.95, configuredOpacity / Math.sqrt(distance)));
        }
    }

    private static final class MarkerPillGeometry {

    static List<MapCanvasPoint> doorHandleHitShape(DungeonMapRenderState.Marker marker) {
        boolean horizontal = horizontalMarker(marker);
        double halfLength = 0.22;
        double halfThickness = 0.18;
        return horizontal
                ? horizontalPill(marker.q(), marker.r(), halfLength, halfThickness)
                : verticalPill(marker.q(), marker.r(), halfLength, halfThickness);
    }

    static List<MapCanvasPoint> handlePill(DungeonMapRenderState.Marker marker) {
        boolean horizontal = horizontalMarker(marker);
        double halfLength = marker.isDoorMarker() ? 0.22 : 0.24;
        double halfThickness = marker.isDoorMarker() ? 0.09 : 0.08;
        return horizontal
                ? horizontalPill(marker.q(), marker.r(), halfLength, halfThickness)
                : verticalPill(marker.q(), marker.r(), halfLength, halfThickness);
    }

    static List<MapCanvasPoint> transitionEdgePill(DungeonMapRenderState.Marker marker) {
        return horizontalMarker(marker)
                ? horizontalPill(marker.q(), marker.r(), 0.16, 0.07)
                : verticalPill(marker.q(), marker.r(), 0.16, 0.07);
    }

    private static boolean horizontalMarker(DungeonMapRenderState.Marker marker) {
        DungeonEdgeRef sourceEdge = marker.sourceEdge() == null
                ? marker.handle().sourceEdge()
                : marker.sourceEdge();
        if (sourceEdge != null) {
            return sourceEdge.from().r() == sourceEdge.to().r();
        }
        return !"EAST".equals(marker.handle().direction())
                && !"WEST".equals(marker.handle().direction());
    }

    private static List<MapCanvasPoint> horizontalPill(
            double centerQ,
            double centerR,
            double halfLength,
            double halfThickness
    ) {
        return List.of(
                new MapCanvasPoint(centerQ - halfLength, centerR - halfThickness),
                new MapCanvasPoint(centerQ + halfLength, centerR - halfThickness),
                new MapCanvasPoint(centerQ + halfLength + halfThickness, centerR),
                new MapCanvasPoint(centerQ + halfLength, centerR + halfThickness),
                new MapCanvasPoint(centerQ - halfLength, centerR + halfThickness),
                new MapCanvasPoint(centerQ - halfLength - halfThickness, centerR));
    }

    private static List<MapCanvasPoint> verticalPill(
            double centerQ,
            double centerR,
            double halfLength,
            double halfThickness
    ) {
        return List.of(
                new MapCanvasPoint(centerQ - halfThickness, centerR - halfLength),
                new MapCanvasPoint(centerQ, centerR - halfLength - halfThickness),
                new MapCanvasPoint(centerQ + halfThickness, centerR - halfLength),
                new MapCanvasPoint(centerQ + halfThickness, centerR + halfLength),
                new MapCanvasPoint(centerQ, centerR + halfLength + halfThickness),
                new MapCanvasPoint(centerQ - halfThickness, centerR + halfLength));
    }
    }

    private static final class MarkerSimpleGeometry {

    static List<MapCanvasPoint> diamond(double centerQ, double centerR, double radius) {
        return List.of(
                new MapCanvasPoint(centerQ, centerR - radius),
                new MapCanvasPoint(centerQ + radius, centerR),
                new MapCanvasPoint(centerQ, centerR + radius),
                new MapCanvasPoint(centerQ - radius, centerR));
    }

    static List<MapCanvasPoint> circle(double centerQ, double centerR, double radius, int points) {
        List<MapCanvasPoint> result = new ArrayList<>();
        int safePoints = Math.max(8, points);
        for (int index = 0; index < safePoints; index++) {
            double angle = Math.PI * 2.0 * index / safePoints;
            result.add(new MapCanvasPoint(
                    centerQ + Math.cos(angle) * radius,
                    centerR + Math.sin(angle) * radius));
        }
        return List.copyOf(result);
    }
    }

    private static final class PartyTokenGeometry {

    static List<MapCanvasPoint> partyTokenShape(DungeonMapRenderState.PartyToken token) {
        double forwardX = token.heading().dx();
        double forwardY = token.heading().dy();
        double sideX = -forwardY;
        double sideY = forwardX;
        double outerRadius = partyOuterRadiusScene();
        return List.of(
                new MapCanvasPoint(
                        token.q() + forwardX * outerRadius * 1.18,
                        token.r() + forwardY * outerRadius * 1.18),
                new MapCanvasPoint(
                        token.q() + forwardX * outerRadius * 0.54
                                + sideX * outerRadius * 0.76,
                        token.r() + forwardY * outerRadius * 0.54
                                + sideY * outerRadius * 0.76),
                new MapCanvasPoint(
                        token.q() - forwardX * outerRadius * 0.92
                                + sideX * outerRadius * 0.92,
                        token.r() - forwardY * outerRadius * 0.92
                                + sideY * outerRadius * 0.92),
                new MapCanvasPoint(
                        token.q() - forwardX * outerRadius * 1.02,
                        token.r() - forwardY * outerRadius * 1.02),
                new MapCanvasPoint(
                        token.q() - forwardX * outerRadius * 0.92
                                - sideX * outerRadius * 0.92,
                        token.r() - forwardY * outerRadius * 0.92
                                - sideY * outerRadius * 0.92),
                new MapCanvasPoint(
                        token.q() + forwardX * outerRadius * 0.54
                                - sideX * outerRadius * 0.76,
                        token.r() + forwardY * outerRadius * 0.54
                                - sideY * outerRadius * 0.76));
    }

    private static double partyOuterRadiusScene() {
        return 0.26;
    }
    }
}
