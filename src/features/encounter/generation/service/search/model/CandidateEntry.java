package features.encounter.generation.service.search.model;

import features.creatures.model.Creature;
import features.partyanalysis.model.CreatureRoleProfile;
import features.partyanalysis.model.EncounterFunctionRole;
import features.partyanalysis.model.EncounterWeightClass;

/**
 * Candidate creature projection used by the V2 search pipeline.
 */
public record CandidateEntry(
        Creature creature,
        CreatureRoleProfile profile,
        EncounterWeightClass weightClass,
        EncounterFunctionRole primaryRole
) {}
