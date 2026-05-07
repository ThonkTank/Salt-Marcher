package src.domain.creatures.published;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;

public final class CreatureActionDetail {

    private final CreatureCatalogLookup.ActionProfile profile;

    public CreatureActionDetail(
            String actionType,
            String name,
            String description,
            @Nullable Integer toHitBonus
    ) {
        this(new CreatureCatalogLookup.ActionProfile(actionType, name, description, toHitBonus));
    }

    public CreatureActionDetail(CreatureCatalogLookup.ActionProfile profile) {
        this.profile = profile == null ? new CreatureCatalogLookup.ActionProfile("", "", "", null) : profile;
    }

    public static CreatureActionDetail fromProfile(CreatureCatalogLookup.ActionProfile profile) {
        return new CreatureActionDetail(profile);
    }

    public String actionType() {
        return profile.actionType();
    }

    public String name() {
        return profile.name();
    }

    public String description() {
        return profile.description();
    }

    public @Nullable Integer toHitBonus() {
        return profile.toHitBonus();
    }
}
