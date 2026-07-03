package src.features.dungeon.runtime;

import java.util.Objects;
import java.util.Optional;
import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorPointerSession {
    private static final double VERTEX_SNAP_DISTANCE = 0.22;

    private Optional<HoverSample> lastHoverSample = Optional.empty();

    boolean accept(
            PointerAction action,
            DungeonEditorTool tool,
            PointerSample sample,
            int projectionLevel
    ) {
        if (!PointerAction.isMoved(action)) {
            clear();
            return true;
        }
        HoverSample nextSample = HoverSample.from(tool, sample, projectionLevel);
        if (lastHoverSample.filter(nextSample::matches).isPresent()) {
            return false;
        }
        lastHoverSample = Optional.of(nextSample);
        return true;
    }

    void clear() {
        lastHoverSample = Optional.empty();
    }

    private record HoverSample(
            DungeonEditorTool tool,
            int projectionLevel,
            int cellQ,
            int cellR,
            boolean vertexPresent,
            int vertexQ,
            int vertexR,
            DungeonEditorRuntimePointerTarget target
    ) {
        private static HoverSample from(
                DungeonEditorTool tool,
                PointerSample sample,
                int projectionLevel
        ) {
            PointerSample safeSample = sample == null
                    ? new PointerSample(0.0, 0.0, false, false, DungeonEditorRuntimePointerTarget.empty())
                    : sample;
            int vertexQ = Math.toIntExact(Math.round(safeSample.sceneX()));
            int vertexR = Math.toIntExact(Math.round(safeSample.sceneY()));
            boolean vertexPresent = Math.hypot(
                    safeSample.sceneX() - vertexQ,
                    safeSample.sceneY() - vertexR) <= VERTEX_SNAP_DISTANCE;
            return new HoverSample(
                    tool == null ? DungeonEditorTool.SELECT : tool,
                    projectionLevel,
                    (int) Math.floor(safeSample.sceneX()),
                    (int) Math.floor(safeSample.sceneY()),
                    vertexPresent,
                    vertexQ,
                    vertexR,
                    safeSample.target());
        }

        private boolean matches(HoverSample other) {
            return other != null
                    && Objects.equals(tool, other.tool)
                    && projectionLevel == other.projectionLevel
                    && cellQ == other.cellQ
                    && cellR == other.cellR
                    && vertexPresent == other.vertexPresent
                    && vertexQ == other.vertexQ
                    && vertexR == other.vertexR
                    && Objects.equals(target, other.target);
        }
    }
}
