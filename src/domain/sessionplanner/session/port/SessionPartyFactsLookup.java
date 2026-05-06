package src.domain.sessionplanner.session.port;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;

public interface SessionPartyFactsLookup {

    ActivePartyMembersFact loadActivePartyMembers();

    AdventuringDayFact calculateAdventuringDay(List<Integer> levels, int plannedEncounterXp);

    final class ActivePartyMembersFact {

        private final boolean available;
        private final List<PartyMemberProfile> members;
        private final Map<Long, PartyMemberProfile> membersByCharacterId;
        private final String statusText;

        public ActivePartyMembersFact(
                boolean available,
                List<PartyMemberProfile> members,
                String statusText
        ) {
            this.available = available;
            this.members = members == null ? List.of() : List.copyOf(members);
            this.statusText = statusText == null ? "" : statusText.trim();
            Map<Long, PartyMemberProfile> indexed = new LinkedHashMap<>();
            for (PartyMemberProfile member : this.members) {
                indexed.put(member.characterId(), member);
            }
            this.membersByCharacterId = Map.copyOf(indexed);
        }

        public boolean available() {
            return available;
        }

        public List<PartyMemberProfile> members() {
            return members;
        }

        public String statusText() {
            return statusText;
        }

        public @Nullable PartyMemberProfile resolve(long characterId) {
            return membersByCharacterId.get(characterId);
        }
    }

    final class PartyMemberProfile {

        private final long characterId;
        private final String displayName;
        private final int currentLevel;

        public PartyMemberProfile(long characterId, String displayName, int currentLevel) {
            this.characterId = Math.max(0L, characterId);
            this.displayName = displayName == null ? "" : displayName.trim();
            this.currentLevel = Math.max(0, currentLevel);
        }

        public long characterId() {
            return characterId;
        }

        public String displayName() {
            return displayName;
        }

        public int currentLevel() {
            return currentLevel;
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
