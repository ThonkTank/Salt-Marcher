package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "PassiveViewDependencyBoundaries",
        summary = "Passive Views may depend only on their allowed model and passive view surfaces.",
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
                        + "' violates passive-view dependency boundaries via references: "
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
        if (ViewArchitectureSupport.isPrimitiveViewPackage(sourcePackageName)) {
            if ("SUPPORT_VALUE".equals(viewType.bucket())) {
                return false;
            }
            if ("MODEL".equals(viewType.bucket())) {
                return !ViewArchitectureSupport.isPrimitiveModelReferenceAllowedFromPrimitiveView(
                        sourcePackageName, referencedType);
            }
            return !"VIEW".equals(viewType.bucket())
                    || !ViewArchitectureSupport.isPrimitiveViewReferenceAllowedFromPrimitiveView(
                    sourcePackageName, referencedType);
        }
        if ("MODEL".equals(viewType.bucket()) && ViewArchitectureSupport.isPrimitiveModelReference(referencedType)) {
            return false;
        }
        if ("SUPPORT_VALUE".equals(viewType.bucket())) {
            return false;
        }
        if ("VIEW_INPUT_EVENT".equals(viewType.bucket())) {
            return !ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType);
        }
        if ("PUBLISHED_EVENT".equals(viewType.bucket())) {
            return true;
        }
        if ("MODEL".equals(viewType.bucket())) {
            return !ViewArchitectureSupport.isSameViewRootModelReference(sourcePackageName, referencedType);
        }
        return !"VIEW".equals(viewType.bucket())
                || !ViewArchitectureSupport.isSameViewRootOrReusablePassiveViewReference(
                        sourcePackageName, referencedType);
    }
}
