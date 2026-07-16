package features.party.api;

public interface PartyApi {

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

    void moveCharacters(MovePartyCharactersCommand command);

    void calculateAdventuringDay(CalculateAdventuringDayCommand command);
}
