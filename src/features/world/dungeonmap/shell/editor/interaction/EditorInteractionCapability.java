package features.world.dungeonmap.shell.editor.interaction;

import java.util.Objects;
import java.util.function.Function;

public record EditorInteractionCapability(Function<EditorToolContext, EditorHitResolution> resolver) {
    public EditorInteractionCapability {
        resolver = Objects.requireNonNull(resolver, "resolver");
    }

    public EditorHitResolution resolve(EditorToolContext ctx) {
        EditorHitResolution resolution = resolver.apply(ctx);
        return resolution == null ? EditorHitResolution.none() : resolution;
    }
}
