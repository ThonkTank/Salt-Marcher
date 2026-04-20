package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;

@BugPattern(
        name = "ViewRestrictedDependencies",
        summary = "Passive panel views may depend only on JavaFX UI APIs, passive views, and JDK types.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewRestrictedDependencyChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = ViewArchitectureSupport.packageName(tree);
        if (!ViewArchitectureSupport.isPanelViewSource(tree)) {
            return Description.NO_MATCH;
        }

        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (isForbiddenReference(referencedType, packageName)) {
                forbiddenReferences.add(referencedType);
            }
        }

        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("View package '" + packageName
                        + "' violates MVVM dependency rules via references: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }

    private static boolean isForbiddenReference(String referencedType, String sourcePackageName) {
        if (ViewArchitectureSupport.isForbiddenViewInfrastructureJdkType(referencedType)) {
            return true;
        }
        if (referencedType.startsWith("shell.")
                || referencedType.startsWith("src.domain.")
                || referencedType.startsWith("src.data.")) {
            return true;
        }
        ViewArchitectureSupport.ViewTypeInfo viewType = ViewArchitectureSupport.parseViewType(referencedType);
        if (viewType == null) {
            return false;
        }
        if (ViewArchitectureSupport.isReusableDisplayModelReference(referencedType)) {
            return false;
        }
        return !"VIEW".equals(viewType.bucket())
                || !ViewArchitectureSupport.isSameViewRootOrReusablePassiveViewReference(
                        sourcePackageName, referencedType);
    }
}
