package saltmarcher.quality.errorprone.view.intenthandler;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;

@BugPattern(
        name = "ViewIntentHandlerApplicationSinkBoundary",
        summary = "IntentHandlers must not depend directly on ApplicationService types.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewIntentHandlerApplicationSinkBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewIntentHandlerArchitectureSupport.isIntentHandlerSource(tree)) {
            return Description.NO_MATCH;
        }

        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewIntentHandlerArchitectureSupport.collectReferencedTypes(tree)) {
            if (ViewIntentHandlerArchitectureSupport.isApplicationServiceReference(referencedType)) {
                forbiddenReferences.add(referencedType);
            }
        }
        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("IntentHandlers must not reference ApplicationService types directly. Violations: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }
}
