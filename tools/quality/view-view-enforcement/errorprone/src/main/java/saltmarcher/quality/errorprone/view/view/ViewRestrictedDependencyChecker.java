package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;
@BugPattern(
        name = "PassiveViewDependencyBoundaries",
        summary = "Passive Views may depend only on JavaFX/JDK UI types, same-surface support, and their own same-stem ViewInputEvent.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewRestrictedDependencyChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        String packageName = source.packageName();
        String viewSimpleName = source.topLevelSimpleName();
        if (!source.isPassiveViewSource()) {
            return Description.NO_MATCH;
        }

        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbiddenReference(referencedType, packageName, viewSimpleName)) {
                forbiddenReferences.add(referencedType);
            }
        }

        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("View package '" + packageName
                        + "' violates passive-view dependency boundaries via references: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }

    private static boolean isForbiddenReference(
            String referencedType,
            String sourcePackageName,
            String viewSimpleName
    ) {
        if (ViewArchitectureSupport.isForbiddenViewInfrastructureJdkType(referencedType)) {
            return true;
        }
        if (referencedType.startsWith("shell.")
                || referencedType.startsWith("bootstrap.")
                || referencedType.startsWith("src.domain.")
                || referencedType.startsWith("src.data.")) {
            return true;
        }
        if (referencedType.startsWith("src.view.")
                && ViewArchitectureSupport.isOwnTopLevelOrNestedTypeReference(
                sourcePackageName,
                viewSimpleName,
                referencedType)) {
            return false;
        }
        ViewArchitectureSupport.ViewTypeInfo viewType = ViewArchitectureSupport.parseViewType(referencedType);
        if (viewType == null) {
            return referencedType.startsWith("src.view.");
        }
        if ("VIEW_INPUT_EVENT".equals(viewType.bucket())) {
            return !ViewArchitectureSupport.isSameStemViewInputEventReference(
                    sourcePackageName,
                    viewSimpleName,
                    referencedType);
        }
        return true;
    }
}
