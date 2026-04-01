package features.world.dungeonmap.model.geometry;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * Structural union of multiple grid shapes without boolean merge semantics.
 */
public record CompositeShape(List<GridShape> children) implements GridShape {

    public CompositeShape {
        children = normalizeChildren(children);
    }

    public CompositeShape(Collection<? extends GridShape> children) {
        this(children == null ? List.of() : new java.util.ArrayList<>(children));
    }

    @Override
    public GridBounds2x bounds() {
        GridBounds2x result = GridBounds2x.empty();
        for (GridShape child : children) {
            result = result.union(child.bounds());
        }
        return result;
    }

    @Override
    public CompositeShape translatedByCells(Point2i delta) {
        Point2i resolvedDelta = delta == null ? new Point2i(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        return new CompositeShape(children.stream()
                .map(child -> child.translatedByCells(resolvedDelta))
                .toList());
    }

    private static List<GridShape> normalizeChildren(Collection<? extends GridShape> input) {
        LinkedHashSet<GridShape> result = new LinkedHashSet<>();
        if (input != null) {
            for (GridShape child : input) {
                if (child == null || child.isEmpty()) {
                    continue;
                }
                if (child instanceof CompositeShape composite) {
                    result.addAll(composite.children());
                    continue;
                }
                result.add(child);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }
}
