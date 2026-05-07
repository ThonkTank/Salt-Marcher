package src.view.leftbartabs.sessionplanner;

import java.util.Objects;

public record SessionPlannerControlsViewInputEvent(Interaction interaction) {

    public SessionPlannerControlsViewInputEvent {
        Objects.requireNonNull(interaction, "interaction");
    }

    public sealed interface Interaction permits CreateSessionInput, AddParticipantInput, RemoveParticipantInput,
            SetEncounterDaysInput, AttachPlanInput {
    }

    public record CreateSessionInput() implements Interaction {
    }

    public record AddParticipantInput(long characterId) implements Interaction {
        public AddParticipantInput {
            characterId = Math.max(0L, characterId);
        }
    }

    public record RemoveParticipantInput(long characterId) implements Interaction {
        public RemoveParticipantInput {
            characterId = Math.max(0L, characterId);
        }
    }

    public record SetEncounterDaysInput(String encounterDaysText) implements Interaction {
        public SetEncounterDaysInput {
            encounterDaysText = encounterDaysText == null ? "" : encounterDaysText.trim();
        }
    }

    public record AttachPlanInput(long selectedPlanId) implements Interaction {
        public AttachPlanInput {
            selectedPlanId = Math.max(0L, selectedPlanId);
        }
    }
}
