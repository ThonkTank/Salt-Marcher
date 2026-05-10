package src.view.leftbartabs.sessionplanner;

import java.util.Objects;

public record SessionPlannerControlsViewInputEvent(ControlsInput controlsInput) {

    public SessionPlannerControlsViewInputEvent {
        Objects.requireNonNull(controlsInput, "controlsInput");
    }

    public sealed interface ControlsInput permits CreateSessionTrigger, AddParticipantInput, RemoveParticipantInput,
            SetEncounterDaysInput, AttachPlanInput {
    }

    public enum CreateSessionTrigger implements ControlsInput {
        CREATE_SESSION
    }

    public record AddParticipantInput(long participantToAddId) implements ControlsInput {
        public AddParticipantInput {
            participantToAddId = Math.max(0L, participantToAddId);
        }
    }

    public record RemoveParticipantInput(long participantToRemoveId) implements ControlsInput {
        public RemoveParticipantInput {
            participantToRemoveId = Math.max(0L, participantToRemoveId);
        }
    }

    public record SetEncounterDaysInput(String encounterDaysText) implements ControlsInput {
        public SetEncounterDaysInput {
            encounterDaysText = encounterDaysText == null ? "" : encounterDaysText.trim();
        }
    }

    public record AttachPlanInput(long planIdToAttach) implements ControlsInput {
        public AttachPlanInput {
            planIdToAttach = Math.max(0L, planIdToAttach);
        }
    }
}
