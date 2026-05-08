package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.VariableTree;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Modifier;
import javax.lang.model.type.TypeMirror;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

@BugPattern(
        name = "PassiveViewLocalStateBoundary",
        summary = "Passive Views may not own canonical local semantic state.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class PassiveViewLocalStateBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        if (!source.isPassiveViewSource()) {
            return Description.NO_MATCH;
        }

        ClassTree topLevelClass = ViewArchitectureSupport.topLevelClass(tree);
        if (topLevelClass == null) {
            return Description.NO_MATCH;
        }

        String sourcePackageName = source.packageName();
        String viewSimpleName = source.topLevelSimpleName();
        String qualifiedViewName = source.qualifiedTopLevelTypeName();

        Tree[] firstViolationTree = {null};
        Set<String> violations = new LinkedHashSet<>();
        inspectClass(topLevelClass, sourcePackageName, viewSimpleName, qualifiedViewName, violations, firstViolationTree);
        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        Tree diagnosticTree = firstViolationTree[0] == null ? topLevelClass : firstViolationTree[0];
        return buildDescription(diagnosticTree)
                .setMessage("Passive View '" + qualifiedViewName
                        + "' owns local semantic state through mutable fields "
                        + String.join(", ", violations)
                        + ". Passive Views may keep only widget state, the same-stem ViewInputEvent callback seam, and narrow technical reentrancy guards. If these fields are input-relevant or render-preparation facts, move them into the co-located ContributionModel/ContentModel or upstream read-side projection instead of keeping helper-owned state bags in the View.")
                .build();
    }

    private static void inspectClass(
            ClassTree classTree,
            String sourcePackageName,
            String viewSimpleName,
            String qualifiedViewName,
            Set<String> violations,
            Tree[] firstViolationTree
    ) {
        for (Tree member : classTree.getMembers()) {
            if (member instanceof VariableTree variableTree) {
                if (isForbiddenLocalStateField(variableTree, sourcePackageName, viewSimpleName, qualifiedViewName)) {
                    violations.add(variableTree.getName() + ":" + variableTree.getType());
                    if (firstViolationTree[0] == null) {
                        firstViolationTree[0] = variableTree;
                    }
                }
                continue;
            }
            if (member instanceof ClassTree nestedClassTree) {
                inspectClass(
                        nestedClassTree,
                        sourcePackageName,
                        viewSimpleName,
                        qualifiedViewName,
                        violations,
                        firstViolationTree);
            }
        }
    }

    private static boolean isForbiddenLocalStateField(
            VariableTree variableTree,
            String sourcePackageName,
            String viewSimpleName,
            String qualifiedViewName
    ) {
        if (variableTree.getModifiers().getFlags().containsAll(Set.of(Modifier.STATIC, Modifier.FINAL))) {
            return false;
        }

        TypeMirror typeMirror = ASTHelpers.getType(variableTree.getType());
        if (typeMirror == null) {
            return false;
        }

        if (isAllowedTechnicalGuardField(variableTree, typeMirror)) {
            return false;
        }
        if (ViewArchitectureSupport.isConsumerOfSameStemViewInputEvent(typeMirror, sourcePackageName, viewSimpleName)) {
            return false;
        }
        if (isAllowedTechnicalWidgetType(typeMirror)) {
            return false;
        }

        if (isScalarSemanticState(typeMirror) || isCollectionSemanticState(typeMirror)) {
            return true;
        }

        for (String referencedType : ViewArchitectureSupport.collectTypeReferences(typeMirror)) {
            if (isForbiddenReferencedStateType(referencedType, sourcePackageName, qualifiedViewName)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isAllowedTechnicalGuardField(VariableTree variableTree, TypeMirror typeMirror) {
        if (!isScalarType(typeMirror)) {
            return false;
        }
        String fieldName = variableTree.getName().toString();
        return fieldName.startsWith("sync")
                || fieldName.startsWith("suppress")
                || fieldName.startsWith("updating")
                || fieldName.startsWith("rebuild")
                || fieldName.startsWith("publishing")
                || fieldName.startsWith("loading")
                || fieldName.endsWith("Depth");
    }

    private static boolean isAllowedTechnicalWidgetType(TypeMirror typeMirror) {
        Set<String> referencedTypes = ViewArchitectureSupport.collectTypeReferences(typeMirror);
        if (referencedTypes.isEmpty()) {
            return false;
        }
        return referencedTypes.stream().allMatch(PassiveViewLocalStateBoundaryChecker::isAllowedTechnicalWidgetReference);
    }

    private static boolean isAllowedTechnicalWidgetReference(String referencedType) {
        return referencedType.startsWith("javafx.animation.")
                || referencedType.startsWith("javafx.css.")
                || referencedType.startsWith("javafx.event.")
                || referencedType.startsWith("javafx.geometry.")
                || referencedType.startsWith("javafx.scene.")
                || referencedType.startsWith("javafx.stage.")
                || referencedType.startsWith("javafx.util.")
                || referencedType.equals("java.util.function.Consumer");
    }

    private static boolean isScalarSemanticState(TypeMirror typeMirror) {
        String qualifiedName = typeMirror.toString();
        return qualifiedName.equals("boolean")
                || qualifiedName.equals("byte")
                || qualifiedName.equals("short")
                || qualifiedName.equals("int")
                || qualifiedName.equals("long")
                || qualifiedName.equals("float")
                || qualifiedName.equals("double")
                || qualifiedName.equals("char")
                || qualifiedName.equals("java.lang.Boolean")
                || qualifiedName.equals("java.lang.Byte")
                || qualifiedName.equals("java.lang.Short")
                || qualifiedName.equals("java.lang.Integer")
                || qualifiedName.equals("java.lang.Long")
                || qualifiedName.equals("java.lang.Float")
                || qualifiedName.equals("java.lang.Double")
                || qualifiedName.equals("java.lang.Character")
                || qualifiedName.equals("java.lang.String");
    }

    private static boolean isScalarType(TypeMirror typeMirror) {
        return isScalarSemanticState(typeMirror);
    }

    private static boolean isCollectionSemanticState(TypeMirror typeMirror) {
        String qualifiedName = typeMirror.toString();
        return qualifiedName.startsWith("java.util.Collection<")
                || qualifiedName.startsWith("java.util.List<")
                || qualifiedName.startsWith("java.util.Set<")
                || qualifiedName.startsWith("java.util.Map<")
                || qualifiedName.startsWith("java.util.ArrayList<")
                || qualifiedName.startsWith("java.util.LinkedList<")
                || qualifiedName.startsWith("java.util.HashSet<")
                || qualifiedName.startsWith("java.util.LinkedHashSet<")
                || qualifiedName.startsWith("java.util.HashMap<")
                || qualifiedName.startsWith("java.util.LinkedHashMap<");
    }

    private static boolean isForbiddenReferencedStateType(
            String referencedType,
            String sourcePackageName,
            String qualifiedViewName
    ) {
        if (referencedType == null || referencedType.isBlank()) {
            return false;
        }
        if (referencedType.startsWith("src.domain.")
                || referencedType.startsWith("src.data.")
                || ViewArchitectureSupport.isApplicationServiceReference(referencedType)
                || ViewArchitectureSupport.isTargetPublishedEventReference(referencedType)
                || ViewArchitectureSupport.isSameViewRootModelReference(sourcePackageName, referencedType)
                || ViewArchitectureSupport.isSupportValueReference(referencedType)) {
            return true;
        }
        return referencedType.startsWith(qualifiedViewName + "$")
                || referencedType.startsWith(qualifiedViewName + ".");
    }
}
