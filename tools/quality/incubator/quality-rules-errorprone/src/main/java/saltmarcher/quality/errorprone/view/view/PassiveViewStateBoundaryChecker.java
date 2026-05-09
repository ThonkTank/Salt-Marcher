package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.IfTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.SwitchExpressionTree;
import com.sun.source.tree.SwitchTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import javax.lang.model.element.Modifier;
import javax.lang.model.type.TypeMirror;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

@BugPattern(
        name = "PassiveViewStateBoundary",
        summary = "Passive Views may not own semantic state, locally reshape prepared render facts, or branch on model-derived presentation decisions.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class PassiveViewStateBoundaryChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Set<String> FORBIDDEN_STREAM_METHODS = Set.of(
            "collect",
            "distinct",
            "filter",
            "flatMap",
            "flatMapToDouble",
            "flatMapToInt",
            "flatMapToLong",
            "map",
            "mapMulti",
            "mapToDouble",
            "mapToInt",
            "mapToLong",
            "sorted",
            "toList");

    private static final Set<String> FORBIDDEN_COMPARATOR_METHODS = Set.of(
            "comparing",
            "comparingDouble",
            "comparingInt",
            "comparingLong",
            "naturalOrder",
            "reverseOrder");

    private static final Set<String> PRESENTATION_MUTATION_METHODS = Set.of(
            "setDisable",
            "setManaged",
            "setText",
            "setVisible");

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
        collectDataShapingViolations(tree, qualifiedViewName, violations, firstViolationTree);
        collectPresentationDecisionViolations(tree, sourcePackageName, violations, firstViolationTree);

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(firstViolationTree[0] == null ? topLevelClass : firstViolationTree[0])
                .setMessage("Passive View '" + qualifiedViewName
                        + "' violates the passive-View state boundary through "
                        + String.join(", ", violations)
                        + ". Semantic state, local shaping, and model-derived presentation decisions belong outside the View.")
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
                    violations.add("local state " + variableTree.getName() + ":" + variableTree.getType());
                    recordViolationTree(variableTree, firstViolationTree);
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

    private static void collectDataShapingViolations(
            CompilationUnitTree tree,
            String qualifiedViewName,
            Set<String> violations,
            Tree[] firstViolationTree
    ) {
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol == null) {
                    return super.visitMethodInvocation(methodInvocationTree, unused);
                }
                String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                String methodName = symbol.getSimpleName().toString();
                if (isForbiddenDataShapingCall(ownerType, methodName)) {
                    violations.add("data shaping " + ownerType + "." + methodName + "()");
                    recordViolationTree(methodInvocationTree, firstViolationTree);
                }
                return super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);
    }

    private static void collectPresentationDecisionViolations(
            CompilationUnitTree tree,
            String sourcePackageName,
            Set<String> violations,
            Tree[] firstViolationTree
    ) {
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitIf(IfTree ifTree, Void unused) {
                if (referencesModelDerivedState(ifTree.getCondition(), sourcePackageName)
                        && (containsPresentationMutation(ifTree.getThenStatement())
                        || containsPresentationMutation(ifTree.getElseStatement()))) {
                    violations.add("presentation decision if-branch");
                    recordViolationTree(ifTree, firstViolationTree);
                }
                return super.visitIf(ifTree, unused);
            }

            @Override
            public Void visitSwitch(SwitchTree switchTree, Void unused) {
                if (referencesModelDerivedState(switchTree.getExpression(), sourcePackageName)
                        && containsPresentationMutation(switchTree)) {
                    violations.add("presentation decision switch");
                    recordViolationTree(switchTree, firstViolationTree);
                }
                return super.visitSwitch(switchTree, unused);
            }

            @Override
            public Void visitSwitchExpression(SwitchExpressionTree switchExpressionTree, Void unused) {
                if (referencesModelDerivedState(switchExpressionTree.getExpression(), sourcePackageName)
                        && containsPresentationMutation(switchExpressionTree)) {
                    violations.add("presentation decision switch expression");
                    recordViolationTree(switchExpressionTree, firstViolationTree);
                }
                return super.visitSwitchExpression(switchExpressionTree, unused);
            }
        }.scan(tree, null);
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

    private static boolean isAllowedTechnicalWidgetType(TypeMirror typeMirror) {
        Set<String> referencedTypes = ViewArchitectureSupport.collectTypeReferences(typeMirror);
        if (referencedTypes.isEmpty()) {
            return false;
        }
        return referencedTypes.stream().allMatch(PassiveViewStateBoundaryChecker::isAllowedTechnicalWidgetReference);
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
                || referencedType.startsWith("shell.")
                || ViewArchitectureSupport.isApplicationServiceReference(referencedType)
                || ViewArchitectureSupport.isTargetPublishedEventReference(referencedType)
                || ViewArchitectureSupport.isSameViewRootModelReference(sourcePackageName, referencedType)
                || ViewArchitectureSupport.parseViewType(referencedType) != null) {
            return true;
        }
        return referencedType.startsWith(qualifiedViewName + "$")
                || referencedType.startsWith(qualifiedViewName + ".");
    }

    private static boolean isForbiddenDataShapingCall(String ownerType, String methodName) {
        if (ownerType == null || ownerType.isBlank()) {
            return false;
        }
        if ((ownerType.equals("java.util.stream.Stream")
                || ownerType.equals("java.util.stream.IntStream")
                || ownerType.equals("java.util.stream.LongStream")
                || ownerType.equals("java.util.stream.DoubleStream"))
                && FORBIDDEN_STREAM_METHODS.contains(methodName)) {
            return true;
        }
        if ("java.util.stream.Collectors".equals(ownerType)) {
            return true;
        }
        if ("java.util.Comparator".equals(ownerType) && FORBIDDEN_COMPARATOR_METHODS.contains(methodName)) {
            return true;
        }
        if ("java.util.Collections".equals(ownerType) && "sort".equals(methodName)) {
            return true;
        }
        return "javafx.collections.FXCollections".equals(ownerType) && methodName.startsWith("observable");
    }

    private static boolean referencesModelDerivedState(Tree tree, String sourcePackageName) {
        if (tree == null) {
            return false;
        }
        Set<String> referencedTypes = new LinkedHashSet<>();
        new TreeScanner<Void, Void>() {
            @Override
            public Void scan(Tree currentTree, Void unused) {
                if (currentTree != null) {
                    ViewArchitectureSupport.collectReferencedTypes(currentTree, referencedTypes);
                }
                return super.scan(currentTree, unused);
            }
        }.scan(tree, null);
        return referencedTypes.stream().anyMatch(referencedType ->
                ViewArchitectureSupport.isSameViewRootModelReference(sourcePackageName, referencedType));
    }

    private static boolean containsPresentationMutation(Tree tree) {
        if (tree == null) {
            return false;
        }
        boolean[] found = {false};
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree methodInvocationTree, Void unused) {
                Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
                if (symbol != null && PRESENTATION_MUTATION_METHODS.contains(symbol.getSimpleName().toString())) {
                    found[0] = true;
                    return null;
                }
                return found[0] ? null : super.visitMethodInvocation(methodInvocationTree, unused);
            }
        }.scan(tree, null);
        return found[0];
    }

    private static void recordViolationTree(Tree tree, Tree[] firstViolationTree) {
        if (firstViolationTree[0] == null && tree != null) {
            firstViolationTree[0] = tree;
        }
    }
}
