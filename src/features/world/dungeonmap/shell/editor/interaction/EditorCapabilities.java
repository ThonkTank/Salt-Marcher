package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.state.EditorHover;
import features.world.dungeonmap.state.EditorHoverScope;

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
        Objects.requireNonNull(resolvedRefResolver, "resolvedRefResolver");
        if (matcher == null && fallbackHitRefResolver == null) {
            throw new IllegalArgumentException("interaction capability requires matcher or fallback");
        }
        return capability(ctx -> resolve(ctx, matcher, fallbackHitRefResolver, resolvedRefResolver, hoverScope));
    }

    private static EditorHitResolution resolve(
            EditorToolContext ctx,
            Predicate<DungeonSelectionRef> matcher,
            Function<EditorToolContext, DungeonSelectionRef> fallbackHitRefResolver,
            BiFunction<EditorToolContext, DungeonSelectionRef, DungeonSelectionRef> resolvedRefResolver,
            EditorHoverScope hoverScope
    ) {
        DungeonSelectionRef hitRef = resolveHitRef(ctx, matcher, fallbackHitRefResolver);
        if (hitRef == null) {
            return EditorHitResolution.none();
        }
        DungeonSelectionRef resolvedRef = resolvedRefResolver.apply(ctx, hitRef);
        return new EditorHitResolution(hitRef, resolvedRef, resolveHover(hitRef, resolvedRef, hoverScope));
    }

    private static DungeonSelectionRef resolveHitRef(
            EditorToolContext ctx,
            Predicate<DungeonSelectionRef> matcher,
            Function<EditorToolContext, DungeonSelectionRef> fallbackHitRefResolver
    ) {
        if (ctx == null) {
            return null;
        }
        if (matcher != null) {
            List<DungeonSelectionRef> refs = ctx.snapshot() == null ? List.of() : ctx.snapshot().orderedRefs();
            for (DungeonSelectionRef ref : refs) {
                if (ref != null && matcher.test(ref)) {
                    return ref;
                }
            }
        }
        return fallbackHitRefResolver == null ? null : fallbackHitRefResolver.apply(ctx);
    }

    private static EditorHover resolveHover(
            DungeonSelectionRef hitRef,
            DungeonSelectionRef resolvedRef,
            EditorHoverScope hoverScope
    ) {
        if (hoverScope == null || hitRef == null) {
            return null;
        }
        DungeonSelectionRef hoverRef = switch (hoverScope) {
            case OWNER -> resolvedRef == null ? hitRef.ownerRef() : resolvedRef;
            case PART -> hitRef;
        };
        return hoverRef == null ? null : new EditorHover(hoverRef, hoverScope);
    }
}
