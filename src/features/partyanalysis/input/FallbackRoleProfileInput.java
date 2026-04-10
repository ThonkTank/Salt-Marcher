package features.partyanalysis.input;

import features.creatures.model.Creature;
import features.encounter.calibration.service.EncounterCalibrationService.EncounterPartyBenchmarks;
import features.partyanalysis.model.CreatureRoleProfile;
import features.partyanalysis.model.StaticCreatureRoleHint;

@SuppressWarnings("unused")
public record FallbackRoleProfileInput(
        Creature creature,
        EncounterPartyBenchmarks partyBenchmarks,
        StaticCreatureRoleHint staticRoleHint
) {

    public record FallbackRoleProfileResolvedInput(CreatureRoleProfile roleProfile) {
    }
}
