package features.encounter.generation.service.search.model;

import features.creaturecatalog.model.Creature;
import features.encounter.analysis.model.CreatureRoleProfile;
import features.encounter.analysis.model.EncounterFunctionRole;
import features.encounter.analysis.model.EncounterWeightClass;
import features.gamerules.model.MonsterRole;

/**
 * Candidate creature projection used by the V2 search pipeline.
 */
public record CandidateEntry(
        Creature creature,
        CreatureRoleProfile profile,
        MonsterRole slotRole,
        EncounterWeightClass weightClass,
        EncounterFunctionRole primaryRole
) {}
