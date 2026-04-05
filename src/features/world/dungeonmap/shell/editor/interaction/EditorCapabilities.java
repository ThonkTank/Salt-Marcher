package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.state.EditorHoverScope;

import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.function.Predicate;

public final class EditorCapabilities {

    private EditorCapabilities() {
    }

    public static EditorInteractionCapability owner(Predicate<DungeonSelectionRef> matcher) {
        return owner(matcher, (ctx, hitRef) -> hitRef == null ? null : hitRef.ownerRef());
    }

    public static EditorInteractionCapability owner(
            Predicate<DungeonSelectionRef> matcher,
            BiFunction<EditorToolContext, DungeonSelectionRef, DungeonSelectionRef> resolvedRefResolver
    ) {
        return capability(matcher, null, resolvedRefResolver, EditorHoverScope.OWNER);
    }

    public static EditorInteractionCapability part(Predicate<DungeonSelectionRef> matcher) {
        return part(matcher, (ctx, hitRef) -> hitRef);
    }

    public static EditorInteractionCapability part(
            Predicate<DungeonSelectionRef> matcher,
            BiFunction<EditorToolContext, DungeonSelectionRef, DungeonSelectionRef> resolvedRefResolver
    ) {
        return capability(matcher, null, resolvedRefResolver, EditorHoverScope.PART);
    }

    public static EditorInteractionCapability ref(Predicate<DungeonSelectionRef> matcher) {
        return capability(matcher, null, (ctx, hitRef) -> hitRef, null);
    }

    public static EditorInteractionCapability partFallback(Function<EditorToolContext, DungeonSelectionRef> fallbackHitRefResolver) {
        return capability(null, fallbackHitRefResolver, (ctx, hitRef) -> hitRef, EditorHoverScope.PART);
    }

    public static EditorInteractionCapability refFallback(Function<EditorToolContext, DungeonSelectionRef> fallbackHitRefResolver) {
        return capability(null, fallbackHitRefResolver, (ctx, hitRef) -> hitRef, null);
    }

    public static EditorInteractionCapability capability(
            Predicate<DungeonSelectionRef> matcher,
            Function<EditorToolContext, DungeonSelectionRef> fallbackHitRefResolver,
            BiFunction<EditorToolContext, DungeonSelectionRef, DungeonSelectionRef> resolvedRefResolver,
            EditorHoverScope hoverScope
    ) {
        return new EditorInteractionCapability(matcher, fallbackHitRefResolver, resolvedRefResolver, hoverScope);
    }
}
