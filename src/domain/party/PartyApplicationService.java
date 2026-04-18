package src.domain.party;

import src.domain.party.api.ActivePartyCompositionResult;
import src.domain.party.api.ActivePartyResult;
import src.domain.party.api.AdventuringDayResult;
import src.domain.party.api.CharacterDraft;
import src.domain.party.api.MembershipState;
import src.domain.party.api.MutationResult;
import src.domain.party.api.PartySnapshotResult;
import src.domain.party.api.RestType;
import src.domain.party.roster.PartyRosterRepository;
import src.domain.party.application.PartyMutationOperations;
import src.domain.party.application.PartyQueryOperations;
import src.domain.party.roster.PartyMembership;
import src.domain.party.roster.PartyRestType;

import java.util.List;
import java.util.Objects;

/**
 * Public backend facade for party management.
 */
public final class PartyApplicationService {

    @FunctionalInterface
    public interface Factory {

        PartyApplicationService create();
    }

    private final PartyQueryOperations queries;
    private final PartyMutationOperations mutations;

    public PartyApplicationService(PartyRosterRepository rosterRepository) {
        PartyRosterRepository repository = Objects.requireNonNull(rosterRepository, "rosterRepository");
        this.queries = new PartyQueryOperations(repository);
        this.mutations = new PartyMutationOperations(repository);
    }

    public PartySnapshotResult loadSnapshot() {
        return queries.loadSnapshot();
    }

    public ActivePartyResult loadActiveParty() {
        return queries.loadActiveParty();
    }

    public ActivePartyCompositionResult loadActivePartyComposition() {
        return queries.loadActivePartyComposition();
    }

    public AdventuringDayResult loadAdventuringDaySummary() {
        return queries.loadAdventuringDaySummary();
    }

    public MutationResult createCharacter(CharacterDraft draft, MembershipState membership) {
        return mutations.createCharacter(draft, PartyMembership.fromApi(membership));
    }

    public MutationResult updateCharacter(long id, CharacterDraft draft) {
        return mutations.updateCharacter(id, draft);
    }

    public MutationResult deleteCharacter(long id) {
        return mutations.deleteCharacter(id);
    }

    public MutationResult setMembership(long id, MembershipState membership) {
        return mutations.setMembership(id, PartyMembership.fromApi(membership));
    }

    public MutationResult awardXp(List<Long> ids, int xpPerCharacter) {
        return mutations.awardXp(ids, xpPerCharacter);
    }

    public MutationResult performRest(RestType restType) {
        return mutations.performRest(PartyRestType.fromApi(restType));
    }
}
