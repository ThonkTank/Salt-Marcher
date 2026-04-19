package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;

@BugPattern(
        name = "ViewModelFrameworkIndependence",
        summary = "View contribution models may use shell contracts, passive views, and domain public boundaries, but not old view topology or data.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewModelFrameworkIndependenceChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = ViewArchitectureSupport.packageName(tree);
        if (!ViewArchitectureSupport.VIEW_MODEL_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }

        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            collectForbiddenReferences(referencedType, forbiddenReferences);
        }

        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Package '" + packageName
                        + "' violates MVVM ViewModel independence via references: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }

    private static void collectForbiddenReferences(String qualifiedName, Set<String> forbiddenReferences) {
        if (qualifiedName == null || qualifiedName.isBlank()) {
            return;
        }
        if (isForbidden(qualifiedName)) {
            forbiddenReferences.add(qualifiedName);
        }
    }

    private static boolean isForbidden(String referencedType) {
        if (referencedType.startsWith("javafx.")) {
            return !ViewArchitectureSupport.isAllowedModelJavafxType(referencedType);
        }
        if (referencedType.startsWith("shell.")) {
            return !ViewArchitectureSupport.isAllowedModelShellType(referencedType);
        }
        if (referencedType.startsWith("src.data.")) {
            return true;
        }
        if (referencedType.startsWith("src.domain.")) {
            return !ViewArchitectureSupport.isAllowedDomainBoundary(referencedType);
        }
        ViewArchitectureSupport.ViewTypeInfo viewType = ViewArchitectureSupport.parseViewType(referencedType);
        if (viewType == null) {
            return false;
        }
        return !"MODEL".equals(viewType.bucket()) && !"VIEW".equals(viewType.bucket());
    }
}
