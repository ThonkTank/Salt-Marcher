package src.domain.dungeon.published;

import java.util.List;

public record DungeonMapProjectionContent<C, E, L, M, N, G>(
        List<C> cells,
        List<E> edges,
        List<L> labels,
        List<M> markers,
        List<N> graphNodes,
        List<G> graphLinks
) {

    public DungeonMapProjectionContent {
        cells = immutableElements(cells);
        edges = immutableElements(edges);
        labels = immutableElements(labels);
        markers = immutableElements(markers);
        graphNodes = immutableElements(graphNodes);
        graphLinks = immutableElements(graphLinks);
    }

    public static <C, E, L, M, N, G> DungeonMapProjectionContent<C, E, L, M, N, G> empty() {
        return new DungeonMapProjectionContent<>(List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
    }

    @Override
    public List<C> cells() {
        return immutableElements(cells);
    }

    @Override
    public List<E> edges() {
        return immutableElements(edges);
    }

    @Override
    public List<L> labels() {
        return immutableElements(labels);
    }

    @Override
    public List<M> markers() {
        return immutableElements(markers);
    }

    @Override
    public List<N> graphNodes() {
        return immutableElements(graphNodes);
    }

    @Override
    public List<G> graphLinks() {
        return immutableElements(graphLinks);
    }

    private static <T> List<T> immutableElements(List<T> elements) {
        return elements == null ? List.of() : List.copyOf(elements);
    }
}
