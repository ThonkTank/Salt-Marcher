package src.view.creatures.interactor;

import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.layout.VBox;
import src.domain.creatures.api.CreatureDetail;

final class CreatureInspectorContentFactory {

    private CreatureInspectorContentFactory() {
    }

    static Node build(CreatureDetail detail) {
        CreatureDetailFormatter formatter = new CreatureDetailFormatter(detail);
        VBox content = new VBox(10);
        content.setPadding(new Insets(12));
        content.getChildren().addAll(
                CreatureInspectorNodes.section("Identity",
                        CreatureInspectorNodes.labeled("Type", formatter.typeLine()),
                        CreatureInspectorNodes.labeled("CR", detail.challengeRating()),
                        CreatureInspectorNodes.labeled("XP", Integer.toString(detail.xp())),
                        CreatureInspectorNodes.labeled("Biomes", formatter.joinValues(detail.biomes()))),
                CreatureInspectorNodes.section("Defenses",
                        CreatureInspectorNodes.labeled("HP", formatter.hitPoints()),
                        CreatureInspectorNodes.labeled("AC", formatter.armorClass()),
                        CreatureInspectorNodes.labeled("Senses", detail.senses()),
                        CreatureInspectorNodes.labeled("Passive Perception", Integer.toString(detail.passivePerception())),
                        CreatureInspectorNodes.labeled("Condition Immunities", detail.conditionImmunities()),
                        CreatureInspectorNodes.labeled("Damage Profile", formatter.damageProfile())),
                CreatureInspectorNodes.section("Combat Stats",
                        CreatureInspectorNodes.labeled("Initiative Bonus",
                                detail.initiativeBonus() >= 0 ? "+" + detail.initiativeBonus() : Integer.toString(detail.initiativeBonus())),
                        CreatureInspectorNodes.labeled("Proficiency Bonus",
                                detail.proficiencyBonus() >= 0 ? "+" + detail.proficiencyBonus() : Integer.toString(detail.proficiencyBonus())),
                        CreatureInspectorNodes.labeled("Speed", formatter.speeds()),
                        CreatureInspectorNodes.labeled("Abilities", formatter.abilityScores()),
                        CreatureInspectorNodes.labeled("Saving Throws", detail.savingThrows()),
                        CreatureInspectorNodes.labeled("Skills", detail.skills())),
                CreatureInspectorNodes.section("Narrative",
                        CreatureInspectorNodes.labeled("Alignment", detail.alignment()),
                        CreatureInspectorNodes.labeled("Languages", detail.languages()),
                        CreatureInspectorNodes.labeled("Armor Notes", detail.armorClassNotes())));

        Node actionsSection = CreatureActionSections.build(detail.actions());
        if (actionsSection != null) {
            content.getChildren().add(actionsSection);
        }
        return content;
    }
}
