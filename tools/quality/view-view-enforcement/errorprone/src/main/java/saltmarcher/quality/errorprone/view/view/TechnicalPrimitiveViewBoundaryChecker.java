package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.VariableTree;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Modifier;
import javax.lang.model.type.TypeMirror;

@BugPattern(
        name = "TechnicalPrimitiveViewBoundary",
        summary = "Technical primitive Views may expose and retain only technical View-layer types.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class TechnicalPrimitiveViewBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        if (!ViewArchitectureSupport.isPrimitiveViewSource(tree)) {
            return Description.NO_MATCH;
        }

        ClassTree topLevelClass = ViewArchitectureSupport.topLevelClass(tree);
        if (topLevelClass == null) {
            return Description.NO_MATCH;
        }

        String sourcePackageName = ViewArchitectureSupport.packageName(tree);
        String viewSimpleName = ViewArchitectureSupport.topLevelSimpleName(tree);
        String qualifiedViewName = ViewArchitectureSupport.qualifiedTopLevelTypeName(tree);
        Set<String> violations = new LinkedHashSet<>();
        Tree[] firstViolation = {null};
        for (Tree member : topLevelClass.getMembers()) {
            if (member instanceof MethodTree methodTree) {
                collectMethodViolations(
                        methodTree,
                        sourcePackageName,
                        viewSimpleName,
                        violations,
                        firstViolation);
            } else if (member instanceof VariableTree variableTree) {
                collectFieldViolations(
                        variableTree,
                        sourcePackageName,
                        viewSimpleName,
                        violations,
                        firstViolation);
            }
        }
        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        Tree diagnosticTree = firstViolation[0] == null ? topLevelClass : firstViolation[0];
        return buildDescription(diagnosticTree)
                .setMessage("Technical primitive View '" + qualifiedViewName
                        + "' must stay technical and role-signaled. Violations: "
                        + String.join(", ", violations)
                        + ". slotcontent/primitives/** Views may expose only technical JavaFX/JDK types, same-unit technical *PointerEvent/*Scene/*Signal/*Support carriers, and same-type nested carriers. They must not drift into *ViewInputEvent, *PublishedEvent, *ContentModel, *ContributionModel, *IntentHandler, domain, data, or application-service types.")
                .build();
    }

    private static void collectMethodViolations(
            MethodTree methodTree,
            String sourcePackageName,
            String viewSimpleName,
            Set<String> violations,
            Tree[] firstViolation
    ) {
        if (!isOutwardVisible(methodTree.getModifiers()) || methodTree.getReturnType() == null) {
            return;
        }
        Set<String> forbiddenTypes = collectForbiddenTypeReferences(
                ASTHelpers.getType(methodTree.getReturnType()),
                sourcePackageName,
                viewSimpleName);
        for (VariableTree parameter : methodTree.getParameters()) {
            forbiddenTypes.addAll(collectForbiddenTypeReferences(
                    ASTHelpers.getType(parameter.getType()),
                    sourcePackageName,
                    viewSimpleName));
        }
        if (forbiddenTypes.isEmpty()) {
            return;
        }
        violations.add("method " + methodTree.getName() + "(" + methodTree.getParameters().size() + ") -> "
                + String.join(", ", forbiddenTypes));
        if (firstViolation[0] == null) {
            firstViolation[0] = methodTree;
        }
    }

    private static void collectFieldViolations(
            VariableTree variableTree,
            String sourcePackageName,
            String viewSimpleName,
            Set<String> violations,
            Tree[] firstViolation
    ) {
        if (variableTree.getModifiers().getFlags().containsAll(Set.of(Modifier.STATIC, Modifier.FINAL))) {
            return;
        }
        Set<String> forbiddenTypes = collectForbiddenTypeReferences(
                ASTHelpers.getType(variableTree.getType()),
                sourcePackageName,
                viewSimpleName);
        if (forbiddenTypes.isEmpty()) {
            return;
        }
        violations.add("field " + variableTree.getName() + ":" + String.join(", ", forbiddenTypes));
        if (firstViolation[0] == null) {
            firstViolation[0] = variableTree;
        }
    }

    private static Set<String> collectForbiddenTypeReferences(
            TypeMirror typeMirror,
            String sourcePackageName,
            String viewSimpleName
    ) {
        Set<String> forbiddenTypes = new LinkedHashSet<>();
        if (typeMirror == null) {
            return forbiddenTypes;
        }
        if (ViewArchitectureSupport.isCallbackOrResultProtocolType(typeMirror)) {
            if (!ViewArchitectureSupport.isAllowedTechnicalPrimitiveProtocolType(
                    typeMirror,
                    sourcePackageName,
                    viewSimpleName)) {
                forbiddenTypes.add(typeMirror.toString());
            }
            return forbiddenTypes;
        }
        for (String referencedType : ViewArchitectureSupport.collectTypeReferences(typeMirror)) {
            if (isAllowedTechnicalPrimitiveReference(referencedType, sourcePackageName, viewSimpleName)) {
                continue;
            }
            forbiddenTypes.add(referencedType);
        }
        return forbiddenTypes;
    }

    private static boolean isAllowedTechnicalPrimitiveReference(
            String referencedType,
            String sourcePackageName,
            String viewSimpleName
    ) {
        if (referencedType == null || referencedType.isBlank()) {
            return true;
        }
        if (referencedType.startsWith("java.")
                || referencedType.startsWith("javafx.")
                || referencedType.startsWith("org.jspecify.annotations.")) {
            return true;
        }
        if (ViewArchitectureSupport.isOwnTopLevelOrNestedTypeReference(
                sourcePackageName,
                viewSimpleName,
                referencedType)) {
            return true;
        }
        if (ViewArchitectureSupport.isSupportValueReference(referencedType)) {
            return ViewArchitectureSupport.packageNameOf(referencedType).equals(sourcePackageName);
        }
        return false;
    }

    private static boolean isOutwardVisible(com.sun.source.tree.ModifiersTree modifiersTree) {
        return !modifiersTree.getFlags().contains(Modifier.PRIVATE);
    }
}
