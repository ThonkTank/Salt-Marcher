package saltmarcher.quality.errorprone.view.publishedevent;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreeScanner;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewPublishedEventBoundary",
        summary = "Write-side PublishedEvent carriers stay immutable and free of shell, domain, data, View, Model, and service boundaries.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewPublishedEventBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewArchitectureSupport.isPublishedEventSource(tree)) {
            return Description.NO_MATCH;
        }
        String sourcePackageName = ViewArchitectureSupport.packageName(tree);
        String topLevelSimpleName = ViewArchitectureSupport.topLevelSimpleName(tree);

        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (referencedType == null || referencedType.isBlank()) {
                continue;
            }
            if (!referencedType.contains(".")) {
                continue;
            }
            if (referencedType.startsWith("shell.")
                    || referencedType.startsWith("src.domain.")
                    || referencedType.startsWith("src.data.")
                    || referencedType.startsWith("javafx.")
                    || ViewArchitectureSupport.isApplicationServiceReference(referencedType)) {
                forbiddenReferences.add(referencedType);
                continue;
            }
            if (ViewArchitectureSupport.isAllowedPublishedEventJdkType(referencedType)
                    || ViewArchitectureSupport.isOwnTopLevelOrNestedTypeReference(
                    sourcePackageName,
                    topLevelSimpleName,
                    referencedType)) {
                continue;
            }
            forbiddenReferences.add(referencedType);
        }

        if (!isTopLevelRecord(tree)) {
            forbiddenReferences.add("non-record PublishedEvent shape");
        }

        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("PublishedEvent carriers must stay immutable write-side sink payloads. Violations: "
                        + String.join(", ", forbiddenReferences))
                .build();
    }

    private static boolean isTopLevelRecord(CompilationUnitTree tree) {
        ClassTree topLevelClass = topLevelClass(tree);
        return topLevelClass != null && topLevelClass.getKind() == Tree.Kind.RECORD;
    }

    private static ClassTree topLevelClass(CompilationUnitTree tree) {
        ClassTree[] result = {null};
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitClass(ClassTree classTree, Void unused) {
                if (result[0] == null) {
                    result[0] = classTree;
                }
                return null;
            }
        }.scan(tree, null);
        return result[0];
    }
}
