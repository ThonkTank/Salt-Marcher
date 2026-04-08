package features.world.dungeon.shell.editor.interaction.tasks;

import features.world.dungeon.shell.editor.interaction.input.EditorHitResolution;
import features.world.dungeon.shell.editor.interaction.input.EditorInteractionCapability;
import features.world.dungeon.shell.editor.interaction.input.EditorToolContext;

import java.util.List;
import java.util.Objects;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.function.Predicate;

public final class EditorCapabilities {

    private EditorCapabilities() {
    }

    public static EditorInteractionCapability capability(Function<EditorToolContext, EditorHitResolution> resolver) {
        return new EditorInteractionCapability(Objects.requireNonNull(resolver, "resolver"));
    }

    public static EditorInteractionCapability owner(Predicate<features.world.dungeon.model.interaction.DungeonSelectionRef> matcher) {
        return owner(matcher, (ctx, hitRef) -> ctx == null ? null : ctx.ownerRef(hitRef));
    }

    public static EditorInteractionCapability owner(
            Predicate<features.world.dungeon.model.interaction.DungeonSelectionRef> matcher,
            BiFunction<
                    EditorToolContext,
                    features.world.dungeon.model.interaction.DungeonSelectionRef,
                    features.world.dungeon.model.interaction.DungeonSelectionRef> resolvedRefResolver
    ) {
        return capability(matcher, null, resolvedRefResolver, features.world.dungeon.state.EditorHoverScope.OWNER);
    }

    public static EditorInteractionCapability part(Predicate<features.world.dungeon.model.interaction.DungeonSelectionRef> matcher) {
        return part(matcher, (ctx, hitRef) -> hitRef);
    }

    public static EditorInteractionCapability part(
            Predicate<features.world.dungeon.model.interaction.DungeonSelectionRef> matcher,
            BiFunction<
                    EditorToolContext,
                    features.world.dungeon.model.interaction.DungeonSelectionRef,
                    features.world.dungeon.model.interaction.DungeonSelectionRef> resolvedRefResolver
    ) {
        return capability(matcher, null, resolvedRefResolver, features.world.dungeon.state.EditorHoverScope.PART);
    }

    public static EditorInteractionCapability ref(Predicate<features.world.dungeon.model.interaction.DungeonSelectionRef> matcher) {
        return capability(matcher, null, (ctx, hitRef) -> hitRef, null);
    }

    public static EditorInteractionCapability partFallback(
            Function<EditorToolContext, features.world.dungeon.model.interaction.DungeonSelectionRef> fallbackHitRefResolver
    ) {
        return capability(null, fallbackHitRefResolver, (ctx, hitRef) -> hitRef, features.world.dungeon.state.EditorHoverScope.PART);
    }

    public static EditorInteractionCapability refFallback(
            Function<EditorToolContext, features.world.dungeon.model.interaction.DungeonSelectionRef> fallbackHitRefResolver
    ) {
        return capability(null, fallbackHitRefResolver, (ctx, hitRef) -> hitRef, null);
    }

    public static EditorInteractionCapability capability(
            Predicate<features.world.dungeon.model.interaction.DungeonSelectionRef> matcher,
            Function<EditorToolContext, features.world.dungeon.model.interaction.DungeonSelectionRef> fallbackHitRefResolver,
            BiFunction<
                    EditorToolContext,
                    features.world.dungeon.model.interaction.DungeonSelectionRef,
                    features.world.dungeon.model.interaction.DungeonSelectionRef> resolvedRefResolver,
            features.world.dungeon.state.EditorHoverScope hoverScope
    ) {
        Objects.requireNonNull(resolvedRefResolver, "resolvedRefResolver");
        if (matcher == null && fallbackHitRefResolver == null) {
            throw new IllegalArgumentException("interaction capability requires matcher or fallback");
        }
        return capability(ctx -> resolve(ctx, matcher, fallbackHitRefResolver, resolvedRefResolver, hoverScope));
    }

    private static EditorHitResolution resolve(
            EditorToolContext ctx,
            Predicate<features.world.dungeon.model.interaction.DungeonSelectionRef> matcher,
            Function<EditorToolContext, features.world.dungeon.model.interaction.DungeonSelectionRef> fallbackHitRefResolver,
            BiFunction<
                    EditorToolContext,
                    features.world.dungeon.model.interaction.DungeonSelectionRef,
                    features.world.dungeon.model.interaction.DungeonSelectionRef> resolvedRefResolver,
            features.world.dungeon.state.EditorHoverScope hoverScope
    ) {
        features.world.dungeon.model.interaction.DungeonSelectionRef hitRef = resolveHitRef(ctx, matcher, fallbackHitRefResolver);
        if (hitRef == null) {
            return EditorHitResolution.none();
        }
        features.world.dungeon.model.interaction.DungeonSelectionRef resolvedRef = resolvedRefResolver.apply(ctx, hitRef);
        return new EditorHitResolution(hitRef, resolvedRef, resolveHover(hitRef, resolvedRef, hoverScope));
    }

    private static features.world.dungeon.model.interaction.DungeonSelectionRef resolveHitRef(
            EditorToolContext ctx,
            Predicate<features.world.dungeon.model.interaction.DungeonSelectionRef> matcher,
            Function<EditorToolContext, features.world.dungeon.model.interaction.DungeonSelectionRef> fallbackHitRefResolver
    ) {
        if (ctx == null) {
            return null;
        }
        if (matcher != null) {
            List<features.world.dungeon.model.interaction.DungeonSelectionRef> refs =
                    ctx.snapshot() == null ? List.of() : ctx.snapshot().orderedRefs();
            for (features.world.dungeon.model.interaction.DungeonSelectionRef ref : refs) {
                if (ref != null && matcher.test(ref)) {
                    return ref;
                }
            }
        }
        return fallbackHitRefResolver == null ? null : fallbackHitRefResolver.apply(ctx);
    }

    private static features.world.dungeon.state.EditorHover resolveHover(
            features.world.dungeon.model.interaction.DungeonSelectionRef hitRef,
            features.world.dungeon.model.interaction.DungeonSelectionRef resolvedRef,
            features.world.dungeon.state.EditorHoverScope hoverScope
    ) {
        if (hoverScope == null || hitRef == null) {
            return null;
        }
        features.world.dungeon.model.interaction.DungeonSelectionRef hoverRef = switch (hoverScope) {
            case OWNER -> resolvedRef == null ? null : resolvedRef;
            case PART -> hitRef;
        };
        return hoverRef == null ? null : new features.world.dungeon.state.EditorHover(hoverRef, hoverScope);
    }
}
