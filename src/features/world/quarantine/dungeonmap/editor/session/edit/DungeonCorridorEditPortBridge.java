package features.world.quarantine.dungeonmap.editor.session.edit;

import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint;

import java.util.Objects;

public final class DungeonCorridorEditPortBridge implements DungeonCorridorEditPort {

    private DungeonCorridorEditPort delegate = (start, target) -> {
    };

    public void bind(DungeonCorridorEditPort delegate) {
        this.delegate = Objects.requireNonNull(delegate, "delegate");
    }

    @Override
    public void dispatchCorridorSelection(DungeonCorridorEndpoint start, DungeonCorridorEndpoint target) {
        delegate.dispatchCorridorSelection(start, target);
    }
}
