package src.domain.party;

import java.util.Objects;
import src.domain.party.application.AdjustPartyXpUseCase;
import src.domain.party.application.AwardPartyXpUseCase;
import src.domain.party.application.CreateCharacterUseCase;
import src.domain.party.application.DeleteCharacterUseCase;
import src.domain.party.application.MovePartyCharactersUseCase;
import src.domain.party.application.PartyBoundaryTranslator;
import src.domain.party.application.PartyRuntimeAccess;
import src.domain.party.application.PerformPartyRestUseCase;
import src.domain.party.application.SetPartyMembershipUseCase;
import src.domain.party.application.UpdateCharacterUseCase;
import src.domain.party.published.AdjustPartyXpCommand;
import src.domain.party.published.AwardPartyXpCommand;
import src.domain.party.published.CalculateAdventuringDayCommand;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.DeleteCharacterCommand;
import src.domain.party.published.MovePartyCharactersCommand;
import src.domain.party.published.PerformPartyRestCommand;
import src.domain.party.published.SetPartyMembershipCommand;
import src.domain.party.published.UpdateCharacterCommand;
import src.domain.party.roster.port.PartyRosterRepository;

/**
 * Public backend facade for party management.
 */
public final class PartyApplicationService {

    private final PartyRuntimeAccess runtimeAccess;
    private final CreateCharacterUseCase createCharacterUseCase;
    private final UpdateCharacterUseCase updateCharacterUseCase;
    private final DeleteCharacterUseCase deleteCharacterUseCase;
    private final SetPartyMembershipUseCase setPartyMembershipUseCase;
    private final AdjustPartyXpUseCase adjustPartyXpUseCase;
    private final AwardPartyXpUseCase awardPartyXpUseCase;
    private final PerformPartyRestUseCase performPartyRestUseCase;
    private final MovePartyCharactersUseCase movePartyCharactersUseCase;

    public PartyApplicationService(PartyRosterRepository rosterRepository) {
        PartyRosterRepository repository = Objects.requireNonNull(rosterRepository, "rosterRepository");
        this.runtimeAccess = PartyRuntimeAccess.fromRepository(repository);
        this.createCharacterUseCase = new CreateCharacterUseCase(repository);
        this.updateCharacterUseCase = new UpdateCharacterUseCase(repository);
        this.deleteCharacterUseCase = new DeleteCharacterUseCase(repository);
        this.setPartyMembershipUseCase = new SetPartyMembershipUseCase(repository);
        this.adjustPartyXpUseCase = new AdjustPartyXpUseCase(repository);
        this.awardPartyXpUseCase = new AwardPartyXpUseCase(repository);
        this.performPartyRestUseCase = new PerformPartyRestUseCase(repository);
        this.movePartyCharactersUseCase = new MovePartyCharactersUseCase(repository);
    }

    public void createCharacter(CreateCharacterCommand command) {
        var request = PartyBoundaryTranslator.CreateCharacterRequest.from(command);
        runtimeAccess.runMutation(() -> createCharacterUseCase.execute(
                request.draft(),
                request.membership()));
    }

    public void updateCharacter(UpdateCharacterCommand command) {
        var request = PartyBoundaryTranslator.UpdateCharacterRequest.from(command);
        runtimeAccess.runMutation(() -> updateCharacterUseCase.execute(
                request.id(),
                request.draft()));
    }

    public void deleteCharacter(DeleteCharacterCommand command) {
        var request = PartyBoundaryTranslator.DeleteCharacterRequest.from(command);
        runtimeAccess.runMutation(() -> deleteCharacterUseCase.execute(request.id()));
    }

    public void setMembership(SetPartyMembershipCommand command) {
        var request = PartyBoundaryTranslator.SetMembershipRequest.from(command);
        runtimeAccess.runMutation(() -> setPartyMembershipUseCase.execute(
                request.id(),
                request.membership()));
    }

    public void awardXp(AwardPartyXpCommand command) {
        var request = PartyBoundaryTranslator.AwardXpRequest.from(command);
        runtimeAccess.runMutation(() -> awardPartyXpUseCase.execute(
                request.ids(),
                request.xpPerCharacter()));
    }

    public void adjustXp(AdjustPartyXpCommand command) {
        var request = PartyBoundaryTranslator.AdjustXpRequest.from(command);
        runtimeAccess.runMutation(() -> adjustPartyXpUseCase.execute(
                request.ids(),
                request.xpDelta()));
    }

    public void performRest(PerformPartyRestCommand command) {
        var request = PartyBoundaryTranslator.PartyRestRequest.from(command);
        runtimeAccess.runMutation(() -> performPartyRestUseCase.execute(
                request.restType()));
    }

    public void moveCharacters(MovePartyCharactersCommand command) {
        var request = PartyBoundaryTranslator.MoveCharactersRequest.from(command);
        runtimeAccess.runMutation(() -> movePartyCharactersUseCase.execute(
                request.characterIds(),
                request.target(),
                request.attachToPartyToken()));
    }

    public void calculateAdventuringDay(CalculateAdventuringDayCommand command) {
        var request = PartyBoundaryTranslator.AdventuringDayCalculationRequest.from(command);
        runtimeAccess.publishAdventuringDayCalculation(request.levels(), request.totalGroupXp());
    }
}
