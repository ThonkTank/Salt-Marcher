package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.state.EditorHover;
import features.world.dungeonmap.state.EditorHoverScope;

import java.util.List;
import java.util.Objects;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.function.Predicate;

public record EditorInteractionCapability(
        Predicate<DungeonSelectionRef> matcher,
        Function<EditorToolContext, DungeonSelectionRef> fallbackHitRefResolver,
        BiFunction<EditorToolContext, DungeonSelectionRef, DungeonSelectionRef> resolvedRefResolver,
        EditorHoverScope hoverScope
) {
    public EditorInteractionCapability {
        if (matcher == null && fallbackHitRefResolver == null) {
            throw new IllegalArgumentException("interaction capability requires matcher or fallback");
        }
        resolvedRefResolver = Objects.requireNonNull(resolvedRefResolver, "resolvedRefResolver");
    }

    public EditorHitResolution resolve(EditorToolContext ctx) {
        DungeonSelectionRef hitRef = resolveHitRef(ctx);
        if (hitRef == null) {
            return EditorHitResolution.none();
        }
        DungeonSelectionRef resolvedRef = resolvedRefResolver.apply(ctx, hitRef);
        return new EditorHitResolution(hitRef, resolvedRef, resolveHover(hitRef, resolvedRef));
    }

    private DungeonSelectionRef resolveHitRef(EditorToolContext ctx) {
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

    private EditorHover resolveHover(DungeonSelectionRef hitRef, DungeonSelectionRef resolvedRef) {
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
