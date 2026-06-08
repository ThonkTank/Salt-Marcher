package src.domain.dungeon.model.runtime.editor.session;

import java.util.Locale;

public final class DungeonEditorSaveLabelNameOperation implements DungeonEditorAuthoredOperation.Variant {
    private static final long NO_TARGET_ID = 0L;
    private static final String CLUSTER_TARGET = "CLUSTER";
    private static final String ROOM_TARGET = "ROOM";

    private final String targetKind;
    private final long targetId;
    private final String name;

    public DungeonEditorSaveLabelNameOperation(String targetKind, long targetId, String name) {
        this.targetKind = targetKind == null ? "" : targetKind.trim().toUpperCase(Locale.ROOT);
        this.targetId = Math.max(NO_TARGET_ID, targetId);
        this.name = name == null ? "" : name.trim();
    }

    public boolean cluster() {
        return CLUSTER_TARGET.equals(targetKind);
    }

    public boolean room() {
        return ROOM_TARGET.equals(targetKind);
    }

    public long targetId() {
        return targetId;
    }

    public String name() {
        return name;
    }
}
