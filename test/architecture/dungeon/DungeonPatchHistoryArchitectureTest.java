package architecture.dungeon;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;

import architecture.AnalyzeMainClasses;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaField;
import com.tngtech.archunit.core.domain.JavaModifier;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.util.List;
import java.util.Map;

@AnalyzeMainClasses
public final class DungeonPatchHistoryArchitectureTest {

    private static final String HISTORY_ENTRY =
            "features.dungeon.application.authored.DungeonEditHistory$HistoryEntry";
    private static final String PATCH_ENTRY =
            "features.dungeon.application.authored.DungeonEditHistory$PatchEntry";
    private static final String COMPOUND_PATCH_ENTRY =
            "features.dungeon.application.authored.DungeonEditHistory$CompoundPatchEntry";
    private static final String PATCH =
            "features.dungeon.application.authored.command.DungeonPatch";
    private static final String COMPOUND_PATCH =
            "features.dungeon.application.authored.command.DungeonCompoundPatch";
    private static final String DUNGEON_MAP =
            "features.dungeon.domain.core.structure.DungeonMap";
    private DungeonPatchHistoryArchitectureTest() {
    }

    @ArchTest
    static final ArchRule historyEntriesRetainOnlyForwardAndInversePatches =
            classes()
                    .that()
                    .implement(HISTORY_ENTRY)
                    .should(retainOnlyExactPatchPayloads())
                    .allowEmptyShould(false);

    @ArchTest
    static final ArchRule patchCarriersDoNotContainCompleteDungeonMaps =
            classes()
                    .that()
                    .haveFullyQualifiedName(PATCH)
                    .or()
                    .haveFullyQualifiedName(COMPOUND_PATCH)
                    .should(notStoreCompleteDungeonMaps())
                    .allowEmptyShould(false);

    private static ArchCondition<JavaClass> retainOnlyExactPatchPayloads() {
        Map<String, String> allowedPayloads = Map.of(
                PATCH_ENTRY, PATCH,
                COMPOUND_PATCH_ENTRY, COMPOUND_PATCH);
        return new ArchCondition<>("retain exactly one forward and one inverse patch") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                String payloadType = allowedPayloads.get(item.getName());
                List<JavaField> fields = instanceFields(item);
                boolean valid = payloadType != null
                        && fields.size() == 2
                        && fields.stream().allMatch(field -> field.getRawType().getName().equals(payloadType));
                if (!valid) {
                    events.add(SimpleConditionEvent.violated(
                            item,
                            item.getName() + " must store only forward and inverse patch payloads"));
                }
            }
        };
    }

    private static ArchCondition<JavaClass> notStoreCompleteDungeonMaps() {
        return new ArchCondition<>("not store complete DungeonMap values") {
            @Override
            public void check(JavaClass item, ConditionEvents events) {
                for (JavaField field : instanceFields(item)) {
                    boolean containsMap = field.getAllInvolvedRawTypes().stream()
                            .anyMatch(type -> type.getName().equals(DUNGEON_MAP));
                    if (containsMap) {
                        events.add(SimpleConditionEvent.violated(
                                field,
                                field.getFullName() + " must not carry a complete DungeonMap"));
                    }
                }
            }
        };
    }

    private static List<JavaField> instanceFields(JavaClass item) {
        return item.getFields().stream()
                .filter(field -> !field.getModifiers().contains(JavaModifier.STATIC))
                .toList();
    }
}
