package src.data.sessionplanner.query;

import java.util.List;
import java.util.Objects;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.AdventuringDayPlanningSummary;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.ReadStatus;
import src.domain.sessionplanner.session.port.SessionPartyFactsLookup;

final class SessionPlannerPartyFactsPublishedReadback {

    private SessionPartyFactsLookup.ActivePartyMembersFact currentActivePartyMembers;
    private SessionPartyFactsLookup.AdventuringDayFact currentAdventuringDayFact;

    SessionPlannerPartyFactsPublishedReadback(
            ActivePartyModel activePartyModel,
            AdventuringDayCalculationModel adventuringDayCalculationModel
    ) {
        ActivePartyModel activeParty = Objects.requireNonNull(activePartyModel, "activePartyModel");
        AdventuringDayCalculationModel adventuringDay =
                Objects.requireNonNull(adventuringDayCalculationModel, "adventuringDayCalculationModel");
        this.currentActivePartyMembers = toActivePartyMembersFact(activeParty.current());
        this.currentAdventuringDayFact = toAdventuringDayFact(adventuringDay.current());
        activeParty.subscribe(result -> currentActivePartyMembers = toActivePartyMembersFact(result));
        adventuringDay.subscribe(result -> currentAdventuringDayFact = toAdventuringDayFact(result));
    }

    SessionPartyFactsLookup.ActivePartyMembersFact loadActivePartyMembers() {
        return currentActivePartyMembers;
    }

    SessionPartyFactsLookup.AdventuringDayFact currentAdventuringDayFact() {
        return currentAdventuringDayFact;
    }

    private static SessionPartyFactsLookup.ActivePartyMembersFact toActivePartyMembersFact(ActivePartyResult result) {
        if (result == null || result.status() != ReadStatus.SUCCESS) {
            return new SessionPartyFactsLookup.ActivePartyMembersFact(
                    false,
                    List.of(),
                    "Aktive Party konnte nicht geladen werden.");
        }
        return new SessionPartyFactsLookup.ActivePartyMembersFact(
                true,
                result.members().stream().map(SessionPlannerPartyFactsPublishedReadback::toPartyMemberFact).toList(),
                "");
    }

    private static SessionPartyFactsLookup.AdventuringDayFact toAdventuringDayFact(
            AdventuringDayCalculationResult result
    ) {
        AdventuringDayPlanningSummary summary = result == null ? null : result.planningSummary();
        if (result == null || result.status() != ReadStatus.SUCCESS || summary == null) {
            return SessionPartyFactsLookup.AdventuringDayFact.unavailable();
        }
        return new SessionPartyFactsLookup.AdventuringDayFact(
                true,
                summary.totalBudgetXp(),
                summary.firstShortRestXp(),
                summary.secondShortRestXp(),
                summary.recommendedShortRests(),
                summary.recommendedLongRests());
    }

    private static SessionPartyFactsLookup.PartyMemberProfile toPartyMemberFact(PartyMemberSummary member) {
        return new SessionPartyFactsLookup.PartyMemberProfile(
                member == null || member.id() == null ? 0L : member.id(),
                member == null ? "" : member.name(),
                member == null ? 0 : member.level());
    }
}
