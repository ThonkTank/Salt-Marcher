package src.domain.sessionplanner.session.port;

import java.util.List;

public interface SessionPartyFactsLookup {

    ActivePartyMembersFact loadActivePartyMembers();

    AdventuringDayFact calculateAdventuringDay(List<Integer> levels, int plannedEncounterXp);

    record ActivePartyMembersFact(
            boolean available,
            List<PartyMemberFact> members,
            String statusText
    ) {

        public ActivePartyMembersFact {
            members = members == null ? List.of() : List.copyOf(members);
            statusText = statusText == null ? "" : statusText.trim();
        }
    }

    record PartyMemberFact(
            long characterId,
            String name,
            int level
    ) {

        public PartyMemberFact {
            characterId = Math.max(0L, characterId);
            name = name == null ? "" : name.trim();
            level = Math.max(0, level);
        }
    }

    record AdventuringDayFact(
            boolean available,
            int totalBudgetXp,
            int firstShortRestXp,
            int secondShortRestXp,
            int recommendedShortRests,
            int recommendedLongRests
    ) {

        public static AdventuringDayFact unavailable() {
            return new AdventuringDayFact(false, 0, 0, 0, 0, 0);
        }
    }
}
