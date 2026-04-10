package features.partyanalysis.input;

import features.creatures.model.Creature;
import features.partyanalysis.model.CreatureRoleProfile;

@SuppressWarnings("unused")
public record ClassifyRoleProfileForActivePartyInput(Creature creature) {

    public record ClassifiedRoleProfileForActivePartyInput(CreatureRoleProfile roleProfile) {
    }
}
