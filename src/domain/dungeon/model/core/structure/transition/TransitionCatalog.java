package src.domain.dungeon.model.core.structure.transition;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;

public record TransitionCatalog(List<Transition> transitions) {
    private static final long NO_TRANSITION_ID = 0L;

    public TransitionCatalog {
        transitions = nonNullTransitions(transitions);
    }

    @Override
    public List<Transition> transitions() {
        return List.copyOf(transitions);
    }

    public boolean canCreate(@Nullable Cell anchor, @Nullable TransitionDestination destination) {
        return anchor != null && destination != null && destination.isValid();
    }

    public TransitionCatalog withCreated(
            long transitionId,
            long mapId,
            @Nullable Cell anchor,
            @Nullable TransitionDestination destination
    ) {
        if (!canCreate(anchor, destination)) {
            return this;
        }
        List<Transition> result = new ArrayList<>(transitions);
        result.add(new Transition(transitionId, mapId, "", anchor, destination, null));
        return new TransitionCatalog(result);
    }

    public boolean canDelete(long transitionId) {
        return transitionById(transitionId) != null && !protectedTransition(transitionId);
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
