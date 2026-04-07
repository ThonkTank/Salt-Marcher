package features.world.dungeon.dungeonmap.structure.model.boundary.wall;

import java.util.Objects;

/**
 * App-global definition for authored dungeon wall behavior and rendering.
 *
 * <p>Layouts resolve concrete wall behavior from these named kinds so authored walls can stay lightweight while
 * preserving one shared interpretation for editor, runtime, and persistence.
 */
public final class WallKind {

    public enum RenderStyle {
        SOLID,
        TRANSPARENT,
        GRATE
    }

    public static final long SOLID_WALL_KIND_ID = 1L;
    public static final String SOLID_WALL_KIND_KEY = "solid";
    private static final WallKind SOLID = new WallKind(
            SOLID_WALL_KIND_ID,
            SOLID_WALL_KIND_KEY,
            "Massive Wand",
            true,
            true,
            RenderStyle.SOLID,
            true,
            true);

    private final long wallKindId;
    private final String key;
    private final String name;
    private final boolean blocksPassage;
    private final boolean blocksSight;
    private final RenderStyle renderStyle;
    private final boolean supportsDoorAttachments;
    private final boolean builtIn;

    public WallKind(
            long wallKindId,
            String key,
            String name,
            boolean blocksPassage,
            boolean blocksSight,
            RenderStyle renderStyle,
            boolean supportsDoorAttachments,
            boolean builtIn
    ) {
        if (wallKindId <= 0) {
            throw new IllegalArgumentException("wallKindId must be positive");
        }
        this.wallKindId = wallKindId;
        this.key = normalizedKey(key);
        this.name = normalizedName(name);
        this.blocksPassage = blocksPassage;
        this.blocksSight = blocksSight;
        this.renderStyle = renderStyle == null ? RenderStyle.SOLID : renderStyle;
        this.supportsDoorAttachments = supportsDoorAttachments;
        this.builtIn = builtIn;
    }

    public static WallKind solid() {
        return SOLID;
    }

    public long wallKindId() {
        return wallKindId;
    }

    public String key() {
        return key;
    }

    public String name() {
        return name;
    }

    public boolean blocksPassage() {
        return blocksPassage;
    }

    public boolean blocksSight() {
        return blocksSight;
    }

    public RenderStyle renderStyle() {
        return renderStyle;
    }

    public boolean supportsDoorAttachments() {
        return supportsDoorAttachments;
    }

    public boolean builtIn() {
        return builtIn;
    }

    private static String normalizedKey(String key) {
        String resolved = key == null ? "" : key.trim().toLowerCase(java.util.Locale.ROOT);
        if (resolved.isEmpty()) {
            throw new IllegalArgumentException("Wall kind key is required");
        }
        return resolved;
    }

    private static String normalizedName(String name) {
        String resolved = name == null ? "" : name.trim();
        if (resolved.isEmpty()) {
            throw new IllegalArgumentException("Wall kind name is required");
        }
        return resolved;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof WallKind wallKind)) {
            return false;
        }
        return wallKindId == wallKind.wallKindId
                && blocksPassage == wallKind.blocksPassage
                && blocksSight == wallKind.blocksSight
                && supportsDoorAttachments == wallKind.supportsDoorAttachments
                && builtIn == wallKind.builtIn
                && Objects.equals(key, wallKind.key)
                && Objects.equals(name, wallKind.name)
                && renderStyle == wallKind.renderStyle;
    }

    @Override
    public int hashCode() {
        return Objects.hash(
                wallKindId,
                key,
                name,
                blocksPassage,
                blocksSight,
                renderStyle,
                supportsDoorAttachments,
                builtIn);
    }
}
