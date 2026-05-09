package src.domain.encounter.model.session.model;

import java.util.List;
import java.util.Optional;
import src.domain.encounter.model.session.model.EncounterSessionValues.EncounterCreatureData;
import src.domain.encounter.model.session.model.EncounterSessionValues.CombatCardData;
import src.domain.encounter.model.session.model.EncounterSessionValues.CombatProjectionData;
import src.domain.encounter.model.session.model.EncounterSessionValues.InitiativeEntryData;
import src.domain.encounter.model.session.model.EncounterSessionValues.InitiativeInput;
import src.domain.encounter.model.session.model.EncounterSessionValues.PartyMemberData;

final class CombatSessionSupport {

    private CombatSessionSupport() {
    }

    static Optional<InitiativeEntryData> initiativeEntry(List<InitiativeEntryData> entries, String id) {
        return entries.stream()
                .filter(entry -> entry.id().equals(id))
                .findFirst();
    }

    static Optional<EncounterCreatureData> rosterCreature(List<EncounterCreatureData> roster, String id) {
        return roster.stream()
                .filter(entry -> entry.id().equals(id))
                .findFirst();
    }

    static Optional<PartyMemberData> partyMember(List<PartyMemberData> activeParty, long id) {
        return activeParty.stream()
                .filter(entry -> entry.numericId() == id)
                .findFirst();
    }

    static List<InitiativeInput> safeInitiatives(List<InitiativeInput> initiatives) {
        return initiatives == null ? List.of() : List.copyOf(initiatives);
    }

    static String nameOnly(String label) {
        int detailStart = label.indexOf(" (");
        return detailStart < 0 ? label : label.substring(0, detailStart);
    }

    static String signed(int value) {
        return value >= 0 ? "+" + value : String.valueOf(value);
    }

    static List<PartyMemberData> missingCombatPartyMembers(List<PartyMemberData> activeParty, CombatProjectionData projection) {
        List<String> activePcIds = projection.cards().stream()
                .filter(CombatCardData::playerCharacter)
                .map(CombatCardData::id)
                .toList();
        return activeParty.stream()
                .filter(member -> !activePcIds.contains(member.id()))
                .toList();
    }
}
