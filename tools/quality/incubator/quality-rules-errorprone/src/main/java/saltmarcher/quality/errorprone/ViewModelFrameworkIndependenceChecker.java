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
        summary = "ViewModels stay independent from shell and view classes; binders own shell/view wiring.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewModelFrameworkIndependenceChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String packageName = ViewArchitectureSupport.packageName(tree);
        boolean contribution = ViewArchitectureSupport.isContributionSource(tree);
        boolean binder = ViewArchitectureSupport.isBinderSource(tree);
        boolean viewModel = ViewArchitectureSupport.isViewModelSource(tree);
        boolean inspectorEntry = ViewArchitectureSupport.isInspectorEntrySource(tree);
        if (!contribution && !binder && !viewModel && !inspectorEntry) {
            return Description.NO_MATCH;
        }

        Set<String> forbiddenReferences = new LinkedHashSet<>();
        String sourceText = sourceText(tree, state);
        for (String referencedType : ViewArchitectureSupport.collectReferencedTypes(tree)) {
            collectForbiddenReferences(
                    referencedType,
                    contribution,
                    binder,
                    inspectorEntry,
                    packageName,
                    sourceText,
                    forbiddenReferences);
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

    private static void collectForbiddenReferences(
            String qualifiedName,
            boolean contribution,
            boolean binder,
            boolean inspectorEntry,
            String sourcePackageName,
            String sourceText,
            Set<String> forbiddenReferences) {
        if (qualifiedName == null || qualifiedName.isBlank()) {
            return;
        }
        if (isForbidden(qualifiedName, contribution, binder, inspectorEntry, sourcePackageName, sourceText)) {
            forbiddenReferences.add(qualifiedName);
        }
    }

    private static boolean isForbidden(
            String referencedType,
            boolean contribution,
            boolean binder,
            boolean inspectorEntry,
            String sourcePackageName,
            String sourceText) {
        if ("java.util.concurrent.Callable".equals(referencedType)
                && !sourceText.contains("Callable")
                && !sourceText.contains("java.util.concurrent")) {
            return false;
        }
        if (ViewArchitectureSupport.isForbiddenViewInfrastructureJdkType(referencedType)) {
            return true;
        }
        if (referencedType.startsWith("javafx.")) {
            if (contribution) {
                return true;
            }
            if (inspectorEntry) {
                return !referencedType.equals("javafx.scene.Node");
            }
            return binder
                    ? !ViewArchitectureSupport.isAllowedModelJavafxType(referencedType)
                    : !ViewArchitectureSupport.isAllowedViewModelJavafxType(referencedType);
        }
        if (referencedType.startsWith("shell.")) {
            if (contribution) {
                return !ViewArchitectureSupport.isAllowedContributionShellType(referencedType);
            }
            if (binder) {
                return !ViewArchitectureSupport.isAllowedBinderShellType(referencedType);
            }
            if (inspectorEntry) {
                return !ViewArchitectureSupport.isAllowedInspectorEntryShellType(referencedType);
            }
            return true;
        }
        if (referencedType.startsWith("src.data.")) {
            return true;
        }
        if (referencedType.startsWith("src.domain.")) {
            if (contribution) {
                return true;
            }
            if (sourcePackageName.startsWith("src.view.slotcontent.")) {
                return !referencedType.matches("^src\\.domain\\.[^.]+\\.published\\..+");
            }
            return !ViewArchitectureSupport.isAllowedViewModelDomainBoundary(referencedType);
        }
        ViewArchitectureSupport.ViewTypeInfo viewType = ViewArchitectureSupport.parseViewType(referencedType);
        if (viewType == null) {
            return false;
        }
        if (contribution) {
            if ("CONTRIBUTION".equals(viewType.bucket())
                    && ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType)) {
                return false;
            }
            return !"BINDER".equals(viewType.bucket())
                    || !ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType);
        }
        if (binder) {
            if (ViewArchitectureSupport.isDetailEntryReference(referencedType)) {
                return false;
            }
            if (ViewArchitectureSupport.isSlotcontentModelReference(referencedType)) {
                return false;
            }
            if (ViewArchitectureSupport.isReusableDisplayModelReference(referencedType)) {
                return false;
            }
            if ("CONTRIBUTION".equals(viewType.bucket())
                    || "BINDER".equals(viewType.bucket())
                    || "MODEL".equals(viewType.bucket())) {
                return !ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType);
            }
            if ("VIEW".equals(viewType.bucket())) {
                return !ViewArchitectureSupport.isSameViewRootOrReusablePassiveViewReference(
                        sourcePackageName, referencedType);
            }
            return true;
        }
        if (inspectorEntry) {
            return !("MODEL".equals(viewType.bucket())
                    || "VIEW".equals(viewType.bucket())
                    || "INSPECTOR_ENTRY".equals(viewType.bucket()))
                    || !ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType);
        }
        return !"MODEL".equals(viewType.bucket())
                || (!ViewArchitectureSupport.isSameViewRootReference(sourcePackageName, referencedType)
                && !ViewArchitectureSupport.isReusableDisplayModelReference(referencedType));
    }

    private static String sourceText(CompilationUnitTree tree, VisitorState state) {
        if (tree.getSourceFile() == null) {
            return "";
        }
        try {
            String sourceText = state.getSourceForNode(tree);
            return sourceText == null ? "" : sourceText;
        } catch (IllegalArgumentException ignored) {
            return "";
        }
    }
}
