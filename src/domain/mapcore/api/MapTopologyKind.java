package src.domain.mapcore.published;

/**
 * Supported topology families for shared map rendering contracts.
 */
public enum MapTopologyKind {
    SQUARE,
    HEX;

    public static MapTopologyKind defaultTopology() {
        return SQUARE;
    }
}
