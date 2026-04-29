package saltmarcher.quality.errorprone.view.viewinputevent;

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
        name = "ViewInputEventBoundary",
        summary = "ViewInputEvent carriers stay immutable, type-local, and free of shell, domain, data, and service boundaries.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewInputEventBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewArchitectureSupport.isViewInputEventSource(tree)) {
            return Description.NO_MATCH;
        }
        String sourcePackageName = ViewArchitectureSupport.packageName(tree);
        String topLevelSimpleName = ViewArchitectureSupport.topLevelSimpleName(tree);

        Set<String> forbiddenReferences = new LinkedHashSet<>();
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            if (referencedType == null || referencedType.isBlank()) {
                continue;
            }
            if (referencedType.startsWith("shell.")
                    || referencedType.startsWith("src.domain.")
                    || referencedType.startsWith("src.data.")
                    || ViewArchitectureSupport.isApplicationServiceReference(referencedType)) {
                forbiddenReferences.add(referencedType);
                continue;
            }
            if (referencedType.startsWith("javafx.")
                    && !referencedType.startsWith("javafx.event.")
                    && !referencedType.startsWith("javafx.geometry.")
                    && !referencedType.startsWith("javafx.scene.input.")) {
                forbiddenReferences.add(referencedType);
                continue;
            }
            ViewArchitectureSupport.ViewTypeInfo viewType = ViewArchitectureSupport.parseViewType(referencedType);
            if (viewType == null) {
                continue;
            }
            if (!"VIEW_INPUT_EVENT".equals(viewType.bucket())
                    || !ViewArchitectureSupport.isOwnTopLevelOrNestedTypeReference(
                    sourcePackageName,
                    topLevelSimpleName,
                    referencedType)) {
                forbiddenReferences.add(referencedType);
            }
        }

        if (!isTopLevelRecord(tree)) {
            forbiddenReferences.add("non-record ViewInputEvent shape");
        }

        if (forbiddenReferences.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("ViewInputEvent carriers must stay immutable, co-located, and local to their own carrier type boundary. Violations: "
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
