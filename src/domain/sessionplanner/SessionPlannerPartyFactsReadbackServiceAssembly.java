package src.domain.sessionplanner;

import java.util.List;
import java.util.Objects;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.ActivePartyResult;
import src.domain.party.published.AdventuringDayCalculationModel;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.AdventuringDayPlanningSummary;
import src.domain.party.published.PartyMemberSummary;
import src.domain.party.published.ReadStatus;
import src.domain.sessionplanner.model.session.model.SessionAdventuringDayBudgetFact;
import src.domain.sessionplanner.model.session.model.SessionActivePartyMembersFact;
import src.domain.sessionplanner.model.session.model.SessionPartyMemberProfile;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;

final class SessionPlannerPartyFactsReadbackServiceAssembly implements SessionPartyFactsPort {

    private SessionActivePartyMembersFact currentActivePartyMembers;
    private SessionAdventuringDayBudgetFact currentAdventuringDayFact;

    SessionPlannerPartyFactsReadbackServiceAssembly(
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

    @Override
    public SessionActivePartyMembersFact activePartyMembers() {
        return currentActivePartyMembers;
    }

    @Override
    public SessionAdventuringDayBudgetFact adventuringDayFact() {
        return currentAdventuringDayFact;
    }

    private static SessionActivePartyMembersFact toActivePartyMembersFact(ActivePartyResult result) {
        if (result == null || result.status() != ReadStatus.SUCCESS) {
            return new SessionActivePartyMembersFact(
                    false,
                    List.of(),
                    "Aktive Party konnte nicht geladen werden.");
        }
        return new SessionActivePartyMembersFact(
                true,
                result.members().stream()
                        .map(SessionPlannerPartyFactsReadbackServiceAssembly::toPartyMemberFact)
                        .toList(),
                "");
    }

    private static SessionAdventuringDayBudgetFact toAdventuringDayFact(AdventuringDayCalculationResult result) {
        AdventuringDayPlanningSummary summary = result == null ? null : result.planningSummary();
        if (result == null || result.status() != ReadStatus.SUCCESS || summary == null) {
            return SessionAdventuringDayBudgetFact.unavailable();
        }
        return new SessionAdventuringDayBudgetFact(
                true,
                summary.totalBudgetXp(),
                summary.firstShortRestXp(),
                summary.secondShortRestXp(),
                summary.recommendedShortRests(),
                summary.recommendedLongRests());
    }

    private static SessionPartyMemberProfile toPartyMemberFact(PartyMemberSummary member) {
        return new SessionPartyMemberProfile(
                member == null || member.id() == null ? 0L : member.id(),
                member == null ? "" : member.name(),
                member == null ? 0 : member.level());
    }
}
