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

    public TransitionCatalog withTransition(Transition replacement) {
        if (replacement == null) {
            return this;
        }
        List<Transition> result = new ArrayList<>();
        boolean changed = false;
        for (Transition transition : transitions) {
            if (transition.transitionId() == replacement.transitionId()) {
                result.add(replacement);
                changed = true;
            } else {
                result.add(transition);
            }
        }
        return changed ? new TransitionCatalog(result) : this;
    }

    public TransitionCatalog withoutReverseLinksTo(long transitionId) {
        if (transitionId <= NO_TRANSITION_ID) {
            return this;
        }
        List<Transition> result = new ArrayList<>();
        boolean changed = false;
        for (Transition transition : transitions) {
            if (transition.linkedTransitionId() != null && transition.linkedTransitionId() == transitionId) {
                result.add(transition.withLinkedTransitionId(null));
                changed = true;
            } else {
                result.add(transition);
            }
        }
        return changed ? new TransitionCatalog(result) : this;
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
}
