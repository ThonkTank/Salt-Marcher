package features.dungeon.adapter.javafx.map;

import java.util.List;

/** Canvas-local extent calculated from the render primitives currently presented. */
record DungeonMapPresentationExtent(int width, int height) {
    DungeonMapPresentationExtent {
        width = Math.max(1, width);
        height = Math.max(1, height);
    }

    static DungeonMapPresentationExtent from(
            List<DungeonMapRenderState.Cell> cells,
            List<DungeonMapRenderState.Edge> edges,
            List<DungeonMapRenderState.Label> labels,
            List<DungeonMapRenderState.Marker> markers,
            DungeonMapRenderState.PartyToken partyToken
    ) {
        Accumulator bounds = new Accumulator();
        for (DungeonMapRenderState.Cell cell : safe(cells)) {
            bounds.include(cell.q(), cell.r());
        }
        for (DungeonMapRenderState.Edge edge : safe(edges)) {
            bounds.include(edge.startQ(), edge.startR());
            bounds.include(edge.endQ(), edge.endR());
        }
        for (DungeonMapRenderState.Label label : safe(labels)) {
            bounds.include(label.q(), label.r());
        }
        for (DungeonMapRenderState.Marker marker : safe(markers)) {
            bounds.include(marker.q(), marker.r());
        }
        if (partyToken != null) {
            bounds.include(partyToken.q(), partyToken.r());
        }
        return bounds.extent();
    }

    private static <T> List<T> safe(List<T> values) {
        return values == null ? List.of() : values;
    }

    private static final class Accumulator {
        private boolean present;
        private double minimumQ;
        private double minimumR;
        private double maximumQ;
        private double maximumR;

        private void include(double q, double r) {
            if (!present) {
                present = true;
                minimumQ = maximumQ = q;
                minimumR = maximumR = r;
                return;
            }
            minimumQ = Math.min(minimumQ, q);
            minimumR = Math.min(minimumR, r);
            maximumQ = Math.max(maximumQ, q);
            maximumR = Math.max(maximumR, r);
        }

        private DungeonMapPresentationExtent extent() {
            if (!present) {
                return new DungeonMapPresentationExtent(1, 1);
            }
            return new DungeonMapPresentationExtent(
                    (int) Math.ceil(maximumQ - minimumQ) + 1,
                    (int) Math.ceil(maximumR - minimumR) + 1);
        }
    }
}
