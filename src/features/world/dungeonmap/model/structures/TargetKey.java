package features.world.dungeonmap.model.structures;

public record TargetKey(String prefix, Long id) {

    private static final String UNASSIGNED = "unassigned";

    public static TargetKey of(String prefix, Long id) {
        return new TargetKey(prefix, id);
    }

    public String value() {
        return id == null ? prefix + UNASSIGNED : prefix + id;
    }

    public static boolean matches(String key, String prefix) {
        return key != null && prefix != null && key.startsWith(prefix);
    }

    public static Long parseId(String key, String prefix) {
        if (!matches(key, prefix)) {
            return null;
        }
        String raw = key.substring(prefix.length());
        if (raw.isBlank() || UNASSIGNED.equals(raw)) {
            return null;
        }
        try {
            return Long.parseLong(raw);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
