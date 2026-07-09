package src.domain.dungeon.model.core.structure.transition;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.OptionalLong;
import org.jspecify.annotations.Nullable;

    public record TransitionCatalog(List<Transition> transitions) {
    private static final long NO_TRANSITION_ID = 0L;
    private static final long MIN_MAP_ID = 1L;

    public TransitionCatalog {
        transitions = nonNullTransitions(transitions);
    }

    @Override
    public List<Transition> transitions() {
        return List.copyOf(transitions);
    }

    public boolean canCreate(@Nullable TransitionAnchor anchor, @Nullable TransitionDestination destination) {
        TransitionAnchor safeAnchor = anchor == null ? TransitionAnchor.none() : anchor;
        return safeAnchor.isPlaced() && destination != null && destination.isValid();
    }

    public TransitionCatalog withCreated(
            long transitionId,
            long mapId,
            @Nullable TransitionAnchor anchor,
            @Nullable TransitionDestination destination
    ) {
        if (!canCreate(anchor, destination)) {
            return this;
        }
        TransitionAnchor safeAnchor = anchor == null ? TransitionAnchor.none() : anchor;
        List<Transition> result = new ArrayList<>(transitions);
        result.add(new Transition(transitionId, mapId, "", safeAnchor, destination, null));
        return new TransitionCatalog(result);
    }

    public boolean canDelete(long transitionId) {
        return transitionById(transitionId) != null && !protectedTransition(transitionId);
    }

    public boolean containsTransition(long transitionId) {
        return transitionById(transitionId) != null;
    }

    public @Nullable TransitionDestination destinationByTransitionId(long transitionId) {
        Transition transition = transitionById(transitionId);
        return transition == null ? null : transition.destination();
    }

    public static AuthoredTransitionLinkRewrite authoredTransitionLinkRewrite(
            Collection<AuthoredTransitionLinkMap> loadedMaps,
            long sourceMapId,
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        AuthoredTransitionLink link = authoredTransitionLink(
                sourceMapId,
                sourceTransitionId,
                targetMapId,
                targetTransitionId,
                bidirectional);
        return new AuthoredTransitionLinkRewritePlanner(loadedMaps).rewrite(link);
    }

    public TransitionCatalog withoutTransition(long transitionId) {
        if (!canDelete(transitionId)) {
            return this;
        }
        List<Transition> result = new ArrayList<>();
        for (Transition transition : transitions) {
            if (transition.transitionId() != transitionId) {
                result.add(transition);
            }
        }
        return new TransitionCatalog(result);
    }

    public TransitionCatalog withDescription(long transitionId, String description) {
        if (transitionId <= NO_TRANSITION_ID) {
            return this;
        }
        List<Transition> result = new ArrayList<>();
        boolean changed = false;
        for (Transition transition : transitions) {
            Transition nextTransition = transition.transitionId() == transitionId
                    ? transition.withDescription(description)
                    : transition;
            result.add(nextTransition);
            changed = changed || !nextTransition.equals(transition);
        }
        return changed ? new TransitionCatalog(result) : this;
    }

    public TransitionCatalog withMapLocalAuthoredTransitionLink(AuthoredTransitionLink link) {
        if (!link.isValid()) {
            return this;
        }
        List<Transition> result = new ArrayList<>();
        boolean changed = false;
        for (Transition transition : transitions) {
            Transition nextTransition = withMapLocalAuthoredTransitionLink(transition, link);
            result.add(nextTransition);
            changed = changed || !nextTransition.equals(transition);
        }
        return changed ? new TransitionCatalog(result) : this;
    }

    private static Transition withMapLocalAuthoredTransitionLink(
            Transition transition,
            AuthoredTransitionLink link
    ) {
        Transition nextTransition = withSourceDestination(transition, link);
        nextTransition = withoutReverseLinkTo(nextTransition, link.source().transitionId());
        return withTargetLink(nextTransition, link);
    }

    private static Transition withSourceDestination(
            Transition transition,
            AuthoredTransitionLink link
    ) {
        return link.source().matches(transition)
                ? transition.withDestination(TransitionDestination.dungeonMap(
                        link.target().mapId(),
                        link.target().transitionId()))
                : transition;
    }

    private static Transition withoutReverseLinkTo(Transition transition, long sourceTransitionId) {
        return hasReverseLinkTo(transition, sourceTransitionId)
                ? transition.withLinkedTransitionId(null)
                : transition;
    }

    private static Transition withTargetLink(
            Transition transition,
            AuthoredTransitionLink link
    ) {
        return link.directionality().createsReverseLink() && link.target().matches(transition)
                ? transition.withLinkedTransitionId(link.source().transitionId())
                : transition;
    }

    private static boolean hasReverseLinkTo(Transition transition, long sourceTransitionId) {
        return transition.linkedTransitionId() != null && transition.linkedTransitionId() == sourceTransitionId;
    }

    private static AuthoredTransitionLink authoredTransitionLink(
            long sourceMapId,
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        return new AuthoredTransitionLink(
                new TransitionEndpoint(sourceMapId, sourceTransitionId),
                new TransitionEndpoint(targetMapId, targetTransitionId),
                bidirectional ? TransitionLinkDirectionality.BIDIRECTIONAL : TransitionLinkDirectionality.ONE_WAY);
    }

    private boolean protectedTransition(long transitionId) {
        for (Transition transition : transitions) {
            if ((transition.transitionId() == transitionId && transition.hasLinkedTransition())
                    || (transition.transitionId() != transitionId && transition.referencesTransition(transitionId))) {
                return true;
            }
        }
        return false;
    }

    private @Nullable Transition transitionById(long transitionId) {
        if (transitionId <= NO_TRANSITION_ID) {
            return null;
        }
        for (Transition transition : transitions) {
            if (transition.transitionId() == transitionId) {
                return transition;
            }
        }
        return null;
    }

    private static List<Transition> nonNullTransitions(List<Transition> source) {
        List<Transition> result = new ArrayList<>();
        for (Transition transition : source == null ? List.<Transition>of() : source) {
            if (transition != null) {
                result.add(transition);
            }
        }
        return List.copyOf(result);
    }

    public record AuthoredTransitionLink(
            TransitionEndpoint source,
            TransitionEndpoint target,
            TransitionLinkDirectionality directionality
    ) {

        public AuthoredTransitionLink {
            source = source == null ? TransitionEndpoint.none() : source;
            target = target == null ? TransitionEndpoint.none() : target;
            directionality = directionality == null
                    ? TransitionLinkDirectionality.ONE_WAY
                    : directionality;
        }

        private boolean isValid() {
            return source.isValid() && target.isValid();
        }
    }

    public record AuthoredTransitionLinkMap(long mapId, TransitionCatalog catalog) {

        public AuthoredTransitionLinkMap {
            mapId = Math.max(0L, mapId);
            catalog = catalog == null ? new TransitionCatalog(List.of()) : catalog;
        }
    }

    public static final class AuthoredTransitionLinkRewrite {
        private static final int ACCEPTED = 1;
        private static final int REQUIRES_MAP = 2;
        private static final int REJECTED = 3;

        private final int state;
        private final OptionalLong requestedMapId;
        private final Map<Long, TransitionCatalog> updates;

        private AuthoredTransitionLinkRewrite(
                int state,
                OptionalLong requestedMapId,
                Map<Long, TransitionCatalog> updates
        ) {
            this.state = state;
            this.requestedMapId = requestedMapId == null ? OptionalLong.empty() : requestedMapId;
            this.updates = nonNullUpdateMap(updates);
        }

        public boolean accepted() {
            return state == ACCEPTED;
        }

        public OptionalLong requestedMapId() {
            return requestedMapId;
        }

        public TransitionCatalog catalogFor(long mapId, TransitionCatalog currentCatalog) {
            TransitionCatalog nextCatalog = updates.get(mapId);
            return nextCatalog == null ? currentCatalog : nextCatalog;
        }

        private static AuthoredTransitionLinkRewrite accepted(
                Map<Long, TransitionCatalog> updates
        ) {
            return new AuthoredTransitionLinkRewrite(ACCEPTED, OptionalLong.empty(), updates);
        }

        private static AuthoredTransitionLinkRewrite requiresMap(long mapId) {
            return new AuthoredTransitionLinkRewrite(REQUIRES_MAP, positiveMapId(mapId), Map.of());
        }

        private static AuthoredTransitionLinkRewrite rejected() {
            return new AuthoredTransitionLinkRewrite(REJECTED, OptionalLong.empty(), Map.of());
        }

        private static OptionalLong positiveMapId(long mapId) {
            if (mapId < MIN_MAP_ID) {
                throw new IllegalArgumentException("transition link map request requires a positive map id");
            }
            return OptionalLong.of(mapId);
        }
    }

    private static final class AuthoredTransitionLinkRewritePlanner {
        private final Map<Long, TransitionCatalog> catalogs;

        private AuthoredTransitionLinkRewritePlanner(Collection<AuthoredTransitionLinkMap> loadedMaps) {
            catalogs = loadedCatalogsByMapId(loadedMaps);
        }

        private AuthoredTransitionLinkRewrite rewrite(AuthoredTransitionLink link) {
            if (!link.isValid()) {
                return AuthoredTransitionLinkRewrite.rejected();
            }
            return rewriteValidLink(
                    link,
                    catalogs.get(link.source().mapId()),
                    catalogs.get(link.target().mapId()));
        }

        private AuthoredTransitionLinkRewrite rewriteValidLink(
                AuthoredTransitionLink link,
                @Nullable TransitionCatalog sourceCatalog,
                @Nullable TransitionCatalog targetCatalog
        ) {
            if (sourceCatalog == null || targetCatalog == null) {
                return AuthoredTransitionLinkRewrite.rejected();
            }
            TransitionDestination sourceDestination = sourceCatalog.destinationByTransitionId(link.source().transitionId());
            return rewriteWithSourceDestination(link, targetCatalog, sourceDestination);
        }

        private AuthoredTransitionLinkRewrite rewriteWithSourceDestination(
                AuthoredTransitionLink link,
                TransitionCatalog targetCatalog,
                @Nullable TransitionDestination sourceDestination
        ) {
            if (sourceDestination == null || !targetCatalog.containsTransition(link.target().transitionId())) {
                return AuthoredTransitionLinkRewrite.rejected();
            }
            OptionalLong previousMapId = previousLinkedMapId(sourceDestination);
            if (previousMapId.isPresent() && !catalogs.containsKey(previousMapId.orElseThrow())) {
                return AuthoredTransitionLinkRewrite.requiresMap(previousMapId.orElseThrow());
            }
            return AuthoredTransitionLinkRewrite.accepted(catalogUpdates(link));
        }

        private Map<Long, TransitionCatalog> catalogUpdates(AuthoredTransitionLink link) {
            Map<Long, TransitionCatalog> updates = new LinkedHashMap<>();
            for (Map.Entry<Long, TransitionCatalog> entry : catalogs.entrySet()) {
                TransitionCatalog catalog = entry.getValue();
                TransitionCatalog nextCatalog = catalog.withMapLocalAuthoredTransitionLink(link);
                if (!nextCatalog.equals(catalog)) {
                    updates.put(entry.getKey(), nextCatalog);
                }
            }
            return Map.copyOf(updates);
        }

        private static Map<Long, TransitionCatalog> loadedCatalogsByMapId(
                Collection<AuthoredTransitionLinkMap> loadedMaps
        ) {
            Map<Long, TransitionCatalog> catalogs = new LinkedHashMap<>();
            for (AuthoredTransitionLinkMap loadedMap : loadedMaps == null
                    ? List.<AuthoredTransitionLinkMap>of()
                    : loadedMaps) {
                if (loadedMap != null && loadedMap.mapId() >= MIN_MAP_ID) {
                    catalogs.put(loadedMap.mapId(), loadedMap.catalog());
                }
            }
            return catalogs;
        }

        private static OptionalLong previousLinkedMapId(TransitionDestination previousDestination) {
            return previousDestination.isDungeonMap() && previousDestination.transitionId() != null
                    ? OptionalLong.of(previousDestination.mapId())
                    : OptionalLong.empty();
        }
    }

    private static Map<Long, TransitionCatalog> nonNullUpdateMap(Map<Long, TransitionCatalog> source) {
        Map<Long, TransitionCatalog> result = new LinkedHashMap<>();
        for (Map.Entry<Long, TransitionCatalog> entry : source == null
                ? Map.<Long, TransitionCatalog>of().entrySet()
                : source.entrySet()) {
            if (entry.getKey() != null && entry.getKey() >= MIN_MAP_ID && entry.getValue() != null) {
                result.put(entry.getKey(), entry.getValue());
            }
        }
        return Map.copyOf(result);
    }

    public record TransitionEndpoint(long mapId, long transitionId) {

        private static TransitionEndpoint none() {
            return new TransitionEndpoint(0L, NO_TRANSITION_ID);
        }

        private boolean isValid() {
            return mapId > 0L && transitionId > NO_TRANSITION_ID;
        }

        private boolean matches(Transition transition) {
            return transition.mapId() == mapId && transition.transitionId() == transitionId;
        }
    }

    public enum TransitionLinkDirectionality {
        ONE_WAY,
        BIDIRECTIONAL;

        private boolean createsReverseLink() {
            return this == BIDIRECTIONAL;
        }
    }
}
