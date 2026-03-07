package features.encountertable.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class EncounterTableServiceValidationTest {
    @Test
    void addCreatureReturnsValidationErrorWhenWeightTooLow() {
        EncounterTableService.MutationStatus status = EncounterTableService.addCreature(1L, 1L, 0);
        assertEquals(EncounterTableService.MutationStatus.VALIDATION_ERROR, status);
    }

    @Test
    void addCreatureReturnsValidationErrorWhenWeightTooHigh() {
        EncounterTableService.MutationStatus status = EncounterTableService.addCreature(1L, 1L, 11);
        assertEquals(EncounterTableService.MutationStatus.VALIDATION_ERROR, status);
    }

    @Test
    void updateWeightReturnsValidationErrorWhenWeightTooLow() {
        EncounterTableService.MutationStatus status = EncounterTableService.updateWeight(1L, 1L, 0);
        assertEquals(EncounterTableService.MutationStatus.VALIDATION_ERROR, status);
    }

    @Test
    void updateWeightReturnsValidationErrorWhenWeightTooHigh() {
        EncounterTableService.MutationStatus status = EncounterTableService.updateWeight(1L, 1L, 11);
        assertEquals(EncounterTableService.MutationStatus.VALIDATION_ERROR, status);
    }
}
