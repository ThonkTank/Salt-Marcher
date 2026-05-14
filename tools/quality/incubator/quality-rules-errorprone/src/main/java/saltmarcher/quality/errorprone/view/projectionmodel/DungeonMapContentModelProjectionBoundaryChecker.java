package saltmarcher.quality.errorprone.view.projectionmodel;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewRole;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

@BugPattern(
        name = "DungeonMapContentModelProjectionBoundary",
        summary = "DungeonMapContentModel must own map facts-to-render preparation instead of consuming Travel render-ready projection carriers.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DungeonMapContentModelProjectionBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Set<String> FORBIDDEN_PREFIXES = Set.of(
            "src.domain.dungeon.published.TravelDungeonMapProjectionSnapshot",
            "src.domain.dungeon.model.travel.model.session.helper.TravelDungeonMapProjectionHelper",
            "src.domain.dungeon.model.travel.model.session.helper.TravelDungeonMapProjectionValueHelper");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (!source.isRecognizedViewSource()
                || source.role() != ViewRole.CONTENT_MODEL
                || !"DungeonMapContentModel".equals(source.topLevelSimpleName())) {
            return Description.NO_MATCH;
        }

        Set<String> violations = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbiddenReference(referencedType)) {
                violations.add(referencedType);
            }
        }
        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("DungeonMapContentModel must derive Travel map render state from Dungeon read-side facts"
                        + " instead of consuming a Travel render-ready projection carrier. Forbidden references: "
                        + String.join(", ", violations))
                .build();
    }

    private static boolean isForbiddenReference(String referencedType) {
        if (referencedType == null || referencedType.isBlank()) {
            return false;
        }
        for (String prefix : FORBIDDEN_PREFIXES) {
            if (referencedType.equals(prefix) || referencedType.startsWith(prefix + "$")) {
                return true;
            }
        }
        return false;
    }
}
