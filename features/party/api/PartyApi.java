package features.party.api;

import java.util.concurrent.CompletionStage;

public interface PartyApi {

    java.util.concurrent.CompletionStage<PartyPlanningFactsResponse> loadPlanningFacts(
            PartyPlanningFactsQuery query);

    PartySnapshotModel snapshot();

    ActivePartyModel activeParty();

    ActivePartyCompositionModel activeComposition();

    AdventuringDaySummaryModel adventuringDaySummary();

    PartyTravelPositionsModel travelPositions();

    PartyMutationModel mutation();

    AdventuringDayCalculationModel adventuringDayCalculation();

    void createCharacter(CreateCharacterCommand command);

    void updateCharacter(UpdateCharacterCommand command);

    void deleteCharacter(DeleteCharacterCommand command);

    void setMembership(SetPartyMembershipCommand command);

    void awardXp(AwardPartyXpCommand command);

    void adjustXp(AdjustPartyXpCommand command);

    void performRest(PerformPartyRestCommand command);

    CompletionStage<MutationResult> moveCharacters(MovePartyCharactersCommand command);

    void calculateAdventuringDay(CalculateAdventuringDayCommand command);
}
