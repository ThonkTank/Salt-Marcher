package src.features.dungeon.runtime;

import java.util.Locale;

public record DungeonEditorRuntimeLabelTarget(Kind kind, long id) {
    private static final DungeonEditorRuntimeLabelTarget EMPTY =
            new DungeonEditorRuntimeLabelTarget(Kind.EMPTY, 0L);

    public DungeonEditorRuntimeLabelTarget {
        kind = kind == null ? Kind.EMPTY : kind;
        id = Math.max(0L, id);
        if (kind == Kind.EMPTY || id == 0L) {
            kind = Kind.EMPTY;
            id = 0L;
        }
    }

    public static DungeonEditorRuntimeLabelTarget empty() {
        return EMPTY;
    }

    static DungeonEditorRuntimeLabelTarget orEmpty(DungeonEditorRuntimeLabelTarget target) {
        return target == null ? empty() : target;
    }

    public static DungeonEditorRuntimeLabelTarget room(long roomId) {
        return new DungeonEditorRuntimeLabelTarget(Kind.ROOM, roomId);
    }

    public static DungeonEditorRuntimeLabelTarget cluster(long clusterId) {
        return new DungeonEditorRuntimeLabelTarget(Kind.CLUSTER, clusterId);
    }

    public static DungeonEditorRuntimeLabelTarget from(String targetKind, long targetId) {
        return switch (normalize(targetKind)) {
            case "ROOM" -> room(targetId);
            case "CLUSTER" -> cluster(targetId);
            default -> empty();
        };
    }

    public boolean present() {
        return kind != Kind.EMPTY && id > 0L;
    }

    public String targetKind() {
        return present() ? kind.name() : "";
    }

    public long targetId() {
        return id;
    }

    public String fallbackName() {
        return kind == Kind.CLUSTER ? "Cluster " + id : "Raum " + id;
    }

    public String label() {
        return kind == Kind.CLUSTER ? "Cluster-Name" : "Raum-Name";
    }

    private static String normalize(String targetKind) {
        return targetKind == null ? "" : targetKind.trim().toUpperCase(Locale.ROOT);
    }

    public enum Kind {
        EMPTY,
        ROOM,
        CLUSTER
    }
}
