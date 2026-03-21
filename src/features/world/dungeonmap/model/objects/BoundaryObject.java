package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.VertexPath;

/**
 * Common object-level surface for room boundaries.
 *
 * <p>Geometry stays in the inherited {@link VertexPath}. BoundaryObject only exposes the object semantics that
 * structures need when they treat walls and doors polymorphically.</p>
 */
public interface BoundaryObject {

    VertexPath path();

    boolean blocksTraversal();
}
