package features.sessionplanner.api;

public interface SessionPlannerApi {

    void initialize();

    void createSession(SessionPlannerCatalogCommand.CreateSessionCommand command);

    void selectSession(SessionPlannerCatalogCommand.SelectSessionCommand command);

    void renameSession(SessionPlannerCatalogCommand.RenameSessionCommand command);

    void deleteSession(SessionPlannerCatalogCommand.DeleteSessionCommand command);

    void addParticipant(SessionPlannerParticipantCommand command);

    void removeParticipant(SessionPlannerParticipantCommand command);

    void setEncounterDays(SetSessionEncounterDaysCommand command);

    void addScene(AddSessionSceneCommand command);

    void attachEncounter(AttachSessionEncounterCommand command);

    void detachEncounter(DetachSessionEncounterCommand command);

    void searchEncounterPlans(SearchSessionEncounterPlansCommand command);

    void removeEncounter(SessionPlannerEncounterCommand command);

    void moveEncounterUp(SessionPlannerEncounterCommand command);

    void moveEncounterDown(SessionPlannerEncounterCommand command);

    void selectEncounter(SessionPlannerEncounterCommand command);

    void setEncounterAllocation(SessionPlannerEncounterAllocationCommand command);

    void updateEncounterScene(UpdateSessionEncounterSceneCommand command);

    void setRestGap(SetSessionRestGapCommand command);

    void clearRestGap(ClearSessionRestGapCommand command);

    void addManualLootNote(AddSessionManualLootNoteCommand command);

    void updateManualLootNote(UpdateSessionManualLootNoteCommand command);

    void removeManualLootNote(RemoveSessionManualLootNoteCommand command);

    void prepareSession(PrepareSessionCommand command);

    void cancelPreparation();
}
