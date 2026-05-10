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
        summary = "DungeonMapContentModel must consume runtime-context map projection carriers instead of raw dungeon editor or travel surface families.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DungeonMapContentModelProjectionBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Set<String> FORBIDDEN_PREFIXES = Set.of(
            "src.domain.dungeon.published.DungeonSnapshot",
            "src.domain.dungeon.published.DungeonMapSnapshot",
            "src.domain.dungeon.published.DungeonAreaSnapshot",
            "src.domain.dungeon.published.DungeonBoundarySnapshot",
            "src.domain.dungeon.published.DungeonFeatureSnapshot",
            "src.domain.dungeon.published.DungeonEditorHandleSnapshot",
            "src.domain.dungeoneditor.published.DungeonEditorSurface",
            "src.domain.dungeoneditor.published.DungeonEditorMapSnapshot",
            "src.domain.dungeoneditor.published.DungeonEditorPreview",
            "src.domain.travel.published.TravelDungeonSurface",
            "src.domain.travel.published.TravelDungeonMapSnapshot",
            "src.domain.travel.published.TravelDungeonPosition");

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
                .setMessage("DungeonMapContentModel must read only from the runtime-context map projection carriers"
                        + " (DungeonEditorMapProjectionSnapshot or TravelDungeonMapProjectionSnapshot)"
                        + " instead of raw map surface families. Forbidden references: "
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
