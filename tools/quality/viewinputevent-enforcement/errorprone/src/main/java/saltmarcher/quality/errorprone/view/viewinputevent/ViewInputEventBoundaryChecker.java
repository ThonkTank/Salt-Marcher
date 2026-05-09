package saltmarcher.quality.errorprone.view.viewinputevent;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Modifier;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewInputEventBoundary",
        summary = "ViewInputEvent carriers stay immutable, JDK-only, type-local, and free of shell, domain, data, and service boundaries.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewInputEventBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String sourcePackageName = ViewArchitectureSupport.packageName(tree);
        if (!sourcePackageName.startsWith("src.view.")) {
            return Description.NO_MATCH;
        }
        String topLevelSimpleName = ViewArchitectureSupport.topLevelSimpleName(tree);

        Tree[] firstViolationTree = {null};
        Set<String> violations = new LinkedHashSet<>();
        if (ViewArchitectureSupport.isViewInputEventSource(tree)) {
            collectCarrierBoundaryViolations(tree, sourcePackageName, topLevelSimpleName, violations, firstViolationTree);
        }
        collectCarrierProducerViolations(tree, sourcePackageName, topLevelSimpleName, violations, firstViolationTree);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(firstViolationTree[0] == null ? tree : firstViolationTree[0])
                .setMessage("ViewInputEvent carriers must stay immutable, co-located snapshot records emitted only by their same-stem passive View. Violations: "
                        + String.join(", ", violations))
                .build();
    }

    private static void collectCarrierBoundaryViolations(
            CompilationUnitTree tree,
            String sourcePackageName,
            String topLevelSimpleName,
            Set<String> violations,
            Tree[] firstViolationTree
    ) {
        ClassTree topLevelClass = topLevelClass(tree);
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
                recordViolationTree(topLevelClass, firstViolationTree);
                continue;
            }
            if (referencedType.startsWith("javafx.")) {
                forbiddenReferences.add(referencedType);
                recordViolationTree(topLevelClass, firstViolationTree);
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
                recordViolationTree(topLevelClass, firstViolationTree);
            }
        }

        if (!isTopLevelRecord(tree)) {
            forbiddenReferences.add("non-record ViewInputEvent shape");
            recordViolationTree(topLevelClass, firstViolationTree);
        }
        if (hasExplicitTopLevelNonConstructorMethod(tree)) {
            forbiddenReferences.add("top-level ViewInputEvent helper method");
            recordViolationTree(topLevelClass, firstViolationTree);
        }
        if (hasForbiddenDiscriminatorRecordComponent(tree)) {
            forbiddenReferences.add("top-level ViewInputEvent discriminator component");
            recordViolationTree(topLevelClass, firstViolationTree);
        }
        if (hasForbiddenNestedDiscriminatorEnum(tree)) {
            forbiddenReferences.add("nested ViewInputEvent discriminator enum");
            recordViolationTree(topLevelClass, firstViolationTree);
        }
        if (hasPublishedEventProtocolCoupling(tree)) {
            forbiddenReferences.add("ViewInputEvent PublishedEvent protocol coupling");
            recordViolationTree(topLevelClass, firstViolationTree);
        }
        violations.addAll(forbiddenReferences);
    }

    private static void collectCarrierProducerViolations(
            CompilationUnitTree tree,
            String sourcePackageName,
            String topLevelSimpleName,
            Set<String> violations,
            Tree[] firstViolationTree
    ) {
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitNewClass(NewClassTree newClassTree, Void unused) {
                String constructedType = qualifiedTypeNameOf(newClassTree);
                if (isTopLevelViewInputEventType(constructedType)
                        && !isAllowedTopLevelCarrierProducer(tree, sourcePackageName, topLevelSimpleName, constructedType)) {
                    violations.add("constructs " + topLevelViewInputEventTypeName(constructedType)
                            + " outside same-stem View");
                    recordViolationTree(newClassTree, firstViolationTree);
                }
                return super.visitNewClass(newClassTree, unused);
            }

            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol == null || !symbol.getModifiers().contains(Modifier.STATIC)) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                if (isTopLevelViewInputEventType(ownerType)) {
                    violations.add("invokes static ViewInputEvent API " + ownerType + "." + symbol.getSimpleName());
                    recordViolationTree(methodInvocationTree, firstViolationTree);
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);
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

    private static boolean hasExplicitTopLevelNonConstructorMethod(CompilationUnitTree tree) {
        ClassTree topLevelClass = topLevelClass(tree);
        if (topLevelClass == null) {
            return false;
        }
        for (Tree member : topLevelClass.getMembers()) {
            if (member instanceof MethodTree methodTree && methodTree.getReturnType() != null) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasForbiddenDiscriminatorRecordComponent(CompilationUnitTree tree) {
        ClassTree topLevelClass = topLevelClass(tree);
        if (topLevelClass == null) {
            return false;
        }
        for (Tree member : topLevelClass.getMembers()) {
            if (!(member instanceof VariableTree variableTree)) {
                continue;
            }
            String componentName = variableTree.getName().toString();
            if ("source".equals(componentName) || "action".equals(componentName)) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasForbiddenNestedDiscriminatorEnum(CompilationUnitTree tree) {
        ClassTree topLevelClass = topLevelClass(tree);
        if (topLevelClass == null) {
            return false;
        }
        for (Tree member : topLevelClass.getMembers()) {
            if (!(member instanceof ClassTree nestedType) || nestedType.getKind() != Tree.Kind.ENUM) {
                continue;
            }
            String nestedName = nestedType.getSimpleName().toString();
            if ("Source".equals(nestedName) || "Action".equals(nestedName)) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasPublishedEventProtocolCoupling(CompilationUnitTree tree) {
        ClassTree topLevelClass = topLevelClass(tree);
        if (topLevelClass == null) {
            return false;
        }
        Set<String> referencedTypes = new LinkedHashSet<>();
        ViewArchitectureSupport.collectReferencedTypes(topLevelClass, referencedTypes);
        return referencedTypes.stream()
                .map(ViewArchitectureSupport::topLevelQualifiedTypeNameOf)
                .anyMatch(ViewArchitectureSupport::isTargetPublishedEventReference);
    }

    private static void recordViolationTree(Tree tree, Tree[] firstViolationTree) {
        if (firstViolationTree[0] == null && tree != null) {
            firstViolationTree[0] = tree;
        }
    }

    private static boolean isAllowedTopLevelCarrierProducer(
            CompilationUnitTree tree,
            String sourcePackageName,
            String topLevelSimpleName,
            String referencedType
    ) {
        if (ViewArchitectureSupport.isViewInputEventSource(tree)
                && ViewArchitectureSupport.isOwnTopLevelOrNestedTypeReference(
                sourcePackageName,
                topLevelSimpleName,
                referencedType)) {
            return true;
        }
        return ViewArchitectureSupport.isPanelViewSource(tree)
                && ViewArchitectureSupport.isSameStemViewInputEventReference(
                sourcePackageName,
                topLevelSimpleName,
                referencedType);
    }

    private static String qualifiedTypeNameOf(NewClassTree newClassTree) {
        Symbol symbol = ASTHelpers.getSymbol(newClassTree);
        if (symbol == null) {
            return "";
        }
        String qualifiedTypeName = ViewArchitectureSupport.getQualifiedTypeName(symbol);
        if (qualifiedTypeName != null && !qualifiedTypeName.isBlank()) {
            return qualifiedTypeName;
        }
        return ASTHelpers.getType(newClassTree) == null ? "" : ASTHelpers.getType(newClassTree).toString();
    }

    private static boolean isTopLevelViewInputEventType(String referencedType) {
        if (!ViewArchitectureSupport.isTargetViewInputEventReference(referencedType)) {
            return false;
        }
        return referencedType.equals(topLevelViewInputEventTypeName(referencedType));
    }

    private static String topLevelViewInputEventTypeName(String referencedType) {
        if (referencedType == null || referencedType.isBlank()) {
            return "";
        }
        int markerIndex = referencedType.indexOf("ViewInputEvent");
        if (markerIndex < 0) {
            return ViewArchitectureSupport.topLevelQualifiedTypeNameOf(referencedType);
        }
        return referencedType.substring(0, markerIndex + "ViewInputEvent".length());
    }
}
