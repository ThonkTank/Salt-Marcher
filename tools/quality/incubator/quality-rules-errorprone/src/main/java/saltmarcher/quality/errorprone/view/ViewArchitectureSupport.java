package saltmarcher.quality.errorprone.view;

import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreePathScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Pattern;
import javax.lang.model.element.Element;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.lang.model.type.ArrayType;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.ErrorType;
import javax.lang.model.type.ExecutableType;
import javax.lang.model.type.IntersectionType;
import javax.lang.model.type.NoType;
import javax.lang.model.type.NullType;
import javax.lang.model.type.PrimitiveType;
import javax.lang.model.type.TypeMirror;
import javax.lang.model.type.TypeVariable;
import javax.lang.model.type.UnionType;
import javax.lang.model.type.WildcardType;
import javax.lang.model.util.ElementFilter;
import javax.lang.model.util.SimpleTypeVisitor14;

public final class ViewArchitectureSupport {

    public static final Pattern VIEW_CONTRIBUTION_PACKAGE = Pattern.compile("^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$");
    public static final Pattern VIEW_MODEL_PACKAGE = Pattern.compile("^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$|^src\\.view\\.slotcontent\\.(controls|main|state|details|topbar|primitives)\\.[^.]+$");
    public static final Pattern VIEW_PANEL_PACKAGE = Pattern.compile("^src\\.view\\.slotcontent\\.(controls|main|state|details|topbar|primitives)\\.[^.]+$");
    public static final Pattern VIEW_SLOT_PACKAGE = Pattern.compile("^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$");
    public static final Pattern LEGACY_VIEW_PACKAGE = Pattern.compile("^src\\.view\\.(?!(leftbartabs|statetabs|dropdowns|slotcontent)(\\.|$)).+");
    public static final Pattern DATA_ROOT_PACKAGE = Pattern.compile("^src\\.data\\.([^.]+)$");

    private static final Set<String> BINDER_ALLOWED_SHELL_TYPES = Set.of(
            "shell.api.ContributionKey",
            "shell.api.InspectorEntrySpec",
            "shell.api.InspectorSink",
            "shell.api.NavigationGraphicResource",
            "shell.api.NavigationGroupSpec",
            "shell.api.ShellBinding",
            "shell.api.ShellContributionSpec",
            "shell.api.ShellRuntimeContext",
            "shell.api.ShellStateTabSpec",
            "shell.api.ServiceRegistry",
            "shell.api.ShellSlot",
            "shell.api.ShellLeftBarTabMode",
            "shell.api.ShellLeftBarTabSpec",
            "shell.api.ShellTopBarSpec");
    private static final Set<String> DATA_ROOT_ALLOWED_SHELL_TYPES = Set.of(
            "shell.api.ServiceContribution",
            "shell.api.ServiceRegistry");
    private static final Set<String> FORBIDDEN_VIEW_JDK_INFRASTRUCTURE_TYPES = Set.of(
            "java.lang.ClassLoader",
            "java.lang.Process",
            "java.lang.ProcessBuilder",
            "java.lang.Runtime",
            "java.lang.Thread",
            "java.lang.ThreadGroup",
            "java.util.Timer",
            "java.util.TimerTask");
    private ViewArchitectureSupport() {
    }

    public static String packageName(CompilationUnitTree tree) {
        return tree.getPackageName() == null ? "" : tree.getPackageName().toString();
    }

    public static boolean isBinderSource(CompilationUnitTree tree) {
        return VIEW_CONTRIBUTION_PACKAGE.matcher(packageName(tree)).matches()
                && sourceFileName(tree).endsWith("Binder.java");
    }

    public static boolean isViewModelSource(CompilationUnitTree tree) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        return source.isRecognizedViewSource()
                && (source.role() == ViewRole.LEGACY_VIEW_MODEL
                || source.role() == ViewRole.CONTRIBUTION_MODEL
                || source.role() == ViewRole.CONTENT_MODEL);
    }

    public static boolean isIntentHandlerSource(CompilationUnitTree tree) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        return source.isRecognizedViewSource() && source.role() == ViewRole.INTENT_HANDLER;
    }

    public static boolean isViewInputEventSource(CompilationUnitTree tree) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        return source.isRecognizedViewSource() && source.role() == ViewRole.VIEW_INPUT_EVENT;
    }

    public static boolean isPublishedEventSource(CompilationUnitTree tree) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        return source.isRecognizedViewSource() && source.role() == ViewRole.PUBLISHED_EVENT;
    }

    public static boolean isPanelViewSource(CompilationUnitTree tree) {
        return ViewSourceDescriptor.describe(tree).isPassiveViewSource();
    }

    public static boolean isFeatureSpecificPanelViewSource(CompilationUnitTree tree) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        return source.isActiveRootSource() && source.role() == ViewRole.VIEW;
    }

    public static String topLevelSimpleName(CompilationUnitTree tree) {
        String sourceFileName = sourceFileName(tree);
        if (sourceFileName.endsWith(".java")) {
            return sourceFileName.substring(0, sourceFileName.length() - ".java".length());
        }
        return sourceFileName;
    }

    private static String sourceFileName(CompilationUnitTree tree) {
        if (tree.getSourceFile() == null) {
            return "";
        }
        String name = tree.getSourceFile().getName().replace('\\', '/');
        int separator = name.lastIndexOf('/');
        return separator < 0 ? name : name.substring(separator + 1);
    }

    public static Set<String> collectReferencedTypes(CompilationUnitTree tree) {
        Set<String> referencedTypes = new LinkedHashSet<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void scan(Tree currentTree, Void unused) {
                if (currentTree != null) {
                    collectReferencedTypes(currentTree, referencedTypes);
                }
                return super.scan(currentTree, unused);
            }

            @Override
            public Void visitMemberSelect(MemberSelectTree memberSelectTree, Void unused) {
                collectReferencedTypes(memberSelectTree.getExpression(), referencedTypes);
                return super.visitMemberSelect(memberSelectTree, unused);
            }
        }.scan(tree, null);
        return referencedTypes;
    }

    public static void collectReferencedTypes(Tree tree, Set<String> referencedTypes) {
        Symbol symbol = ASTHelpers.getSymbol(tree);
        if (symbol != null) {
            addReference(getQualifiedTypeName(symbol), referencedTypes);
            addReference(getQualifiedOwnerTypeName(symbol), referencedTypes);
        }
        collectTypeReferences(ASTHelpers.getType(tree), referencedTypes);
    }

    public static void addReference(String qualifiedName, Set<String> referencedTypes) {
        if (qualifiedName != null && !qualifiedName.isBlank()) {
            referencedTypes.add(qualifiedName);
        }
    }

    public static String getQualifiedTypeName(Symbol symbol) {
        if (symbol instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        if (symbol != null && symbol.type != null && symbol.type.tsym instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }

    public static String getQualifiedOwnerTypeName(Symbol symbol) {
        if (symbol == null || symbol.owner == null) {
            return null;
        }
        if (symbol.owner instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }

    public static boolean isAllowedViewModelDomainBoundary(String referencedType) {
        return isDomainApplicationServiceRoot(referencedType)
                || referencedType.matches("^src\\.domain\\.[^.]+\\.published\\..+");
    }

    public static boolean isAllowedPresentationModelDomainBoundary(String referencedType) {
        return referencedType != null
                && referencedType.matches("^src\\.domain\\.[^.]+\\.published\\..+")
                && !isDomainWriteCarrier(referencedType);
    }

    public static boolean isAllowedIntentHandlerDomainBoundary(String sourcePackageName, String referencedType) {
        return false;
    }

    private static boolean isDomainApplicationServiceRoot(String referencedType) {
        return referencedType.matches("^src\\.domain\\.[^.]+\\.[^.]+ApplicationService((\\$|\\.).*)?$");
    }

    public static boolean isApplicationServiceReference(String referencedType) {
        return referencedType != null && isDomainApplicationServiceRoot(referencedType);
    }

    public static boolean isAllowedPublishedEventJdkType(String referencedType) {
        if (referencedType == null || !referencedType.startsWith("java.")) {
            return false;
        }
        return !isForbiddenViewInfrastructureJdkType(referencedType);
    }

    public static boolean isAllowedViewModelJavafxType(String referencedType) {
        return referencedType.startsWith("javafx.beans.")
                || referencedType.startsWith("javafx.collections.");
    }

    public static boolean isAllowedModelJavafxType(String referencedType) {
        return isAllowedViewModelJavafxType(referencedType)
                || referencedType.equals("javafx.scene.Node");
    }

    public static boolean isForbiddenViewInfrastructureJdkType(String referencedType) {
        if (referencedType == null) {
            return false;
        }
        return referencedType.startsWith("java.io.")
                || referencedType.startsWith("java.lang.invoke.")
                || referencedType.startsWith("java.lang.reflect.")
                || referencedType.startsWith("java.net.")
                || referencedType.startsWith("java.nio.file.")
                || referencedType.startsWith("java.sql.")
                || referencedType.startsWith("java.util.concurrent.")
                || FORBIDDEN_VIEW_JDK_INFRASTRUCTURE_TYPES.contains(referencedType)
                || FORBIDDEN_VIEW_JDK_INFRASTRUCTURE_TYPES.stream()
                        .anyMatch(forbiddenType -> referencedType.startsWith(forbiddenType + "$"));
    }

    public static boolean isTargetViewModelReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null && "MODEL".equals(viewType.bucket());
    }

    public static boolean isTopLevelViewModelReference(String referencedType) {
        if (!isTargetViewModelReference(referencedType)) {
            return false;
        }
        String packageName = packageNameOf(referencedType);
        if (packageName.isBlank() || !referencedType.startsWith(packageName + ".")) {
            return false;
        }
        String remainder = referencedType.substring(packageName.length() + 1).replaceFirst("\\$.*$", "");
        return !remainder.contains(".");
    }

    public static boolean isTargetPanelViewReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null && "VIEW".equals(viewType.bucket());
    }

    public static boolean isTargetViewInputEventReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null && "VIEW_INPUT_EVENT".equals(viewType.bucket());
    }

    public static boolean isTargetPublishedEventReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null && "PUBLISHED_EVENT".equals(viewType.bucket());
    }

    public static boolean isTopLevelPublishedEventReference(String referencedType) {
        if (!isTargetPublishedEventReference(referencedType)) {
            return false;
        }
        return referencedType != null
                && !referencedType.contains("$")
                && topLevelQualifiedTypeNameOf(referencedType).endsWith("PublishedEvent");
    }

    public static boolean isSameStemViewInputEventReference(
            String sourcePackageName,
            String viewSimpleName,
            String referencedType
    ) {
        return isOwnTopLevelOrNestedTypeReference(
                sourcePackageName,
                expectedViewInputEventSimpleName(viewSimpleName),
                referencedType);
    }

    public static boolean isOwnTopLevelOrNestedTypeReference(
            String sourcePackageName,
            String topLevelSimpleName,
            String referencedType
    ) {
        String qualifiedTopLevelType = sourcePackageName + "." + topLevelSimpleName;
        return referencedType != null
                && (referencedType.equals(qualifiedTopLevelType)
                || referencedType.startsWith(qualifiedTopLevelType + "$")
                || referencedType.startsWith(qualifiedTopLevelType + "."));
    }

    public static String expectedViewInputEventSimpleName(String viewSimpleName) {
        if (viewSimpleName == null || viewSimpleName.isBlank()) {
            return "";
        }
        return viewSimpleName + "InputEvent";
    }

    public static ViewTypeInfo parseViewType(String referencedType) {
        ViewSourceDescriptor source = ViewSourceDescriptor.describeQualifiedType(referencedType);
        if (!source.packageName().startsWith("src.view.")) {
            return null;
        }
        String component = source.isSlotcontentSource() ? source.slot() : source.area();
        String bucket = switch (source.role()) {
            case CONTRIBUTION -> "CONTRIBUTION";
            case BINDER -> "BINDER";
            case CONTRIBUTION_MODEL, CONTENT_MODEL, LEGACY_VIEW_MODEL -> "MODEL";
            case INTENT_HANDLER -> "HANDLER";
            case VIEW_INPUT_EVENT -> "VIEW_INPUT_EVENT";
            case PUBLISHED_EVENT -> "PUBLISHED_EVENT";
            case INSPECTOR_ENTRY -> "INSPECTOR_ENTRY";
            case VIEW -> "VIEW";
            case PROJECTOR, UNKNOWN -> "LEGACY";
        };
        return new ViewTypeInfo(component == null ? "VIEW_ROOT" : component, bucket);
    }

    public static boolean isLegacyViewReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null && "LEGACY".equals(viewType.bucket());
    }

    public static boolean isSameViewRootReference(String sourcePackageName, String referencedType) {
        return packageNameOf(referencedType).equals(sourcePackageName);
    }

    public static String packageNameOfReferencedType(String referencedType) {
        return packageNameOf(referencedType);
    }

    public static String topLevelQualifiedTypeNameOf(String referencedType) {
        if (referencedType == null || referencedType.isBlank()) {
            return "";
        }
        return referencedType.replaceFirst("\\$.*$", "");
    }

    public static boolean isSameViewUnitReference(String leftReferencedType, String rightReferencedType) {
        return packageNameOf(leftReferencedType).equals(packageNameOf(rightReferencedType));
    }

    public static boolean isReusablePassiveViewReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null
                && (Set.of("controls", "main", "state", "details", "topbar").contains(viewType.component())
                || "primitives".equals(viewType.component()))
                && "VIEW".equals(viewType.bucket());
    }

    public static boolean isSlotcontentInspectorEntryReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null
                && Set.of("controls", "main", "state", "details", "topbar").contains(viewType.component())
                && "INSPECTOR_ENTRY".equals(viewType.bucket());
    }

    public static boolean isSlotcontentModelReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null
                && Set.of("controls", "main", "state", "details", "topbar", "primitives").contains(viewType.component())
                && "MODEL".equals(viewType.bucket());
    }

    public static boolean isSupportValueReference(String referencedType) {
        return false;
    }

    public static boolean isDetailEntryViewReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null
                && "details".equals(viewType.component())
                && "VIEW".equals(viewType.bucket());
    }

    public static boolean isDetailEntryViewModelReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null
                && "details".equals(viewType.component())
                && "MODEL".equals(viewType.bucket());
    }

    public static boolean isDetailEntryReference(String referencedType) {
        return isDetailEntryViewReference(referencedType)
                || isDetailEntryViewModelReference(referencedType)
                || isSlotcontentInspectorEntryReference(referencedType);
    }

    public static boolean isSameViewRootOrReusablePassiveViewReference(String sourcePackageName, String referencedType) {
        return isSameViewRootReference(sourcePackageName, referencedType)
                || isReusablePassiveViewReference(referencedType);
    }

    public static boolean isSameViewRootModelReference(String sourcePackageName, String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null
                && "MODEL".equals(viewType.bucket())
                && isSameViewRootReference(sourcePackageName, referencedType);
    }

    public static boolean isSameViewRootHandlerReference(String sourcePackageName, String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null
                && "HANDLER".equals(viewType.bucket())
                && isSameViewRootReference(sourcePackageName, referencedType);
    }

    public static boolean isConsumerOfSameRootViewInputEvent(TypeMirror typeMirror, String sourcePackageName) {
        return isConsumerOfSameRootCarrier(typeMirror, sourcePackageName, true);
    }

    public static boolean isConsumerOfSameStemViewInputEvent(
            TypeMirror typeMirror,
            String sourcePackageName,
            String viewSimpleName
    ) {
        if (!(typeMirror instanceof DeclaredType declaredType)) {
            return false;
        }
        Element element = declaredType.asElement();
        if (!(element instanceof TypeElement typeElement)
                || !"java.util.function.Consumer".contentEquals(typeElement.getQualifiedName())) {
            return false;
        }
        if (declaredType.getTypeArguments().size() != 1) {
            return false;
        }
        Set<String> referencedTypes = new LinkedHashSet<>();
        collectTypeReferences(declaredType.getTypeArguments().get(0), referencedTypes);
        return referencedTypes.stream()
                .anyMatch(referencedType -> isSameStemViewInputEventReference(
                        sourcePackageName,
                        viewSimpleName,
                        referencedType));
    }

    public static boolean isConsumerOfSameRootPublishedEvent(TypeMirror typeMirror, String sourcePackageName) {
        return isConsumerOfSameRootCarrier(typeMirror, sourcePackageName, false);
    }

    public static boolean isFunctionalInterface(TypeMirror typeMirror) {
        if (typeMirror == null || !(typeMirror instanceof DeclaredType declaredType)) {
            return false;
        }
        Element element = declaredType.asElement();
        if (!(element instanceof TypeElement typeElement) || !typeElement.getKind().isInterface()) {
            return false;
        }
        int abstractMethodCount = 0;
        for (ExecutableElement method : ElementFilter.methodsIn(typeElement.getEnclosedElements())) {
            Set<Modifier> modifiers = method.getModifiers();
            if (modifiers.contains(Modifier.DEFAULT) || modifiers.contains(Modifier.STATIC)) {
                continue;
            }
            if (isJavaLangObjectMethod(method)) {
                continue;
            }
            abstractMethodCount++;
            if (abstractMethodCount > 1) {
                return false;
            }
        }
        return abstractMethodCount == 1;
    }

    public static boolean isCallbackSurfaceType(TypeMirror typeMirror) {
        if (typeMirror == null) {
            return false;
        }
        if (isFunctionalInterface(typeMirror)) {
            return true;
        }
        Set<String> referencedTypes = new LinkedHashSet<>();
        collectTypeReferences(typeMirror, referencedTypes);
        return referencedTypes.stream().anyMatch(ViewArchitectureSupport::isKnownCallbackSurfaceType);
    }

    public static boolean isCallbackOrResultProtocolType(TypeMirror typeMirror) {
        if (typeMirror == null) {
            return false;
        }
        if (isCallbackSurfaceType(typeMirror)) {
            return true;
        }
        Set<String> referencedTypes = new LinkedHashSet<>();
        collectTypeReferences(typeMirror, referencedTypes);
        return referencedTypes.stream().anyMatch(ViewArchitectureSupport::isKnownAsyncProtocolType);
    }

    public static boolean isObservableReadSurfaceType(TypeMirror typeMirror) {
        if (typeMirror == null) {
            return false;
        }
        String qualifiedName = typeMirror.toString();
        return qualifiedName.startsWith("javafx.beans.property.")
                || qualifiedName.startsWith("javafx.beans.value.")
                || qualifiedName.startsWith("javafx.beans.binding.")
                || qualifiedName.startsWith("javafx.collections.ObservableList")
                || qualifiedName.startsWith("javafx.collections.ObservableMap")
                || qualifiedName.startsWith("javafx.collections.ObservableSet");
    }

    public static boolean isObservableMutableSurfaceType(TypeMirror typeMirror) {
        if (typeMirror == null) {
            return false;
        }
        String qualifiedName = typeMirror.toString();
        return qualifiedName.startsWith("javafx.beans.property.")
                || qualifiedName.equals("javafx.beans.value.WritableValue")
                || qualifiedName.startsWith("javafx.beans.value.WritableValue<")
                || qualifiedName.startsWith("javafx.collections.ObservableList")
                || qualifiedName.startsWith("javafx.collections.ObservableMap")
                || qualifiedName.startsWith("javafx.collections.ObservableSet");
    }

    private static boolean isKnownCallbackSurfaceType(String referencedType) {
        if (referencedType == null || referencedType.isBlank()) {
            return false;
        }
        return referencedType.startsWith("javafx.event.")
                || referencedType.equals("javafx.beans.InvalidationListener")
                || referencedType.equals("javafx.beans.value.ChangeListener")
                || referencedType.equals("javafx.collections.ListChangeListener")
                || referencedType.equals("javafx.collections.MapChangeListener")
                || referencedType.equals("javafx.collections.SetChangeListener")
                || referencedType.equals("javafx.collections.WeakListChangeListener")
                || referencedType.equals("javafx.collections.WeakMapChangeListener")
                || referencedType.equals("javafx.collections.WeakSetChangeListener")
                || referencedType.equals("javafx.beans.WeakInvalidationListener")
                || referencedType.equals("javafx.beans.value.WeakChangeListener");
    }

    private static boolean isKnownAsyncProtocolType(String referencedType) {
        if (referencedType == null || referencedType.isBlank()) {
            return false;
        }
        return referencedType.equals("java.util.concurrent.Future")
                || referencedType.equals("java.util.concurrent.CompletableFuture")
                || referencedType.equals("java.util.concurrent.CompletionStage");
    }

    private static boolean isJavaLangObjectMethod(ExecutableElement method) {
        Element enclosingElement = method.getEnclosingElement();
        if (!(enclosingElement instanceof TypeElement typeElement)) {
            return false;
        }
        return "java.lang.Object".contentEquals(typeElement.getQualifiedName());
    }

    private static boolean isConsumerOfSameRootCarrier(
            TypeMirror typeMirror,
            String sourcePackageName,
            boolean viewInputEvent
    ) {
        if (!(typeMirror instanceof DeclaredType declaredType)) {
            return false;
        }
        Element element = declaredType.asElement();
        if (!(element instanceof TypeElement typeElement)
                || !"java.util.function.Consumer".contentEquals(typeElement.getQualifiedName())) {
            return false;
        }
        if (declaredType.getTypeArguments().size() != 1) {
            return false;
        }
        Set<String> referencedTypes = new LinkedHashSet<>();
        collectTypeReferences(declaredType.getTypeArguments().get(0), referencedTypes);
        return referencedTypes.stream()
                .filter(viewInputEvent
                        ? ViewArchitectureSupport::isTargetViewInputEventReference
                        : ViewArchitectureSupport::isTargetPublishedEventReference)
                .anyMatch(referencedType -> isSameViewRootReference(sourcePackageName, referencedType));
    }

    private static String packageNameOf(String referencedType) {
        if (referencedType == null || referencedType.isBlank()) {
            return "";
        }
        String topLevelType = referencedType.replaceFirst("\\$.*$", "");
        if (topLevelType.startsWith("src.view.")) {
            String[] segments = topLevelType.split("\\.");
            if (segments.length >= 6 && "slotcontent".equals(segments[2])) {
                return String.join(".", segments[0], segments[1], segments[2], segments[3], segments[4]);
            }
            if (segments.length >= 4 && Set.of("leftbartabs", "statetabs", "dropdowns").contains(segments[2])) {
                return String.join(".", segments[0], segments[1], segments[2], segments[3]);
            }
        }
        int separator = topLevelType.lastIndexOf('.');
        return separator < 0 ? "" : topLevelType.substring(0, separator);
    }

    public static boolean isAllowedBinderShellType(String referencedType) {
        return isAllowedShellType(referencedType, BINDER_ALLOWED_SHELL_TYPES);
    }

    public static boolean isAllowedDataRootShellType(String referencedType) {
        return isAllowedShellType(referencedType, DATA_ROOT_ALLOWED_SHELL_TYPES);
    }

    private static boolean isDomainWriteCarrier(String referencedType) {
        return referencedType.matches("^src\\.domain\\.[^.]+\\.published\\..*(Command|Query|Operation|Edit)(\\$.*)?$");
    }

    private static boolean isAllowedShellType(String referencedType, Set<String> allowedTypes) {
        if (referencedType == null || !referencedType.startsWith("shell.")) {
            return true;
        }
        for (String allowedType : allowedTypes) {
            if (referencedType.equals(allowedType)
                    || referencedType.startsWith(allowedType + "$")
                    || referencedType.startsWith(allowedType + ".")) {
                return true;
            }
        }
        return false;
    }

    public static void collectTypeReferences(TypeMirror typeMirror, Set<String> referencedTypes) {
        if (typeMirror == null) {
            return;
        }
        typeMirror.accept(new SimpleTypeVisitor14<Void, Void>() {
            @Override
            public Void visitDeclared(DeclaredType declaredType, Void unused) {
                Element element = declaredType.asElement();
                if (element instanceof TypeElement typeElement) {
                    addReference(typeElement.getQualifiedName().toString(), referencedTypes);
                }
                for (TypeMirror typeArgument : declaredType.getTypeArguments()) {
                    typeArgument.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitArray(ArrayType arrayType, Void unused) {
                arrayType.getComponentType().accept(this, null);
                return null;
            }

            @Override
            public Void visitTypeVariable(TypeVariable typeVariable, Void unused) {
                typeVariable.getUpperBound().accept(this, null);
                TypeMirror lowerBound = typeVariable.getLowerBound();
                if (lowerBound != null) {
                    lowerBound.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitWildcard(WildcardType wildcardType, Void unused) {
                if (wildcardType.getExtendsBound() != null) {
                    wildcardType.getExtendsBound().accept(this, null);
                }
                if (wildcardType.getSuperBound() != null) {
                    wildcardType.getSuperBound().accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitExecutable(ExecutableType executableType, Void unused) {
                executableType.getReturnType().accept(this, null);
                for (TypeMirror thrownType : executableType.getThrownTypes()) {
                    thrownType.accept(this, null);
                }
                for (TypeMirror typeVariable : executableType.getTypeVariables()) {
                    typeVariable.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitIntersection(IntersectionType intersectionType, Void unused) {
                for (TypeMirror bound : intersectionType.getBounds()) {
                    bound.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitUnion(UnionType unionType, Void unused) {
                for (TypeMirror alternative : unionType.getAlternatives()) {
                    alternative.accept(this, null);
                }
                return null;
            }

            @Override
            public Void visitError(ErrorType errorType, Void unused) {
                Element element = errorType.asElement();
                if (element instanceof TypeElement typeElement) {
                    addReference(typeElement.getQualifiedName().toString(), referencedTypes);
                }
                return null;
            }

            @Override
            protected Void defaultAction(TypeMirror ignored, Void unused) {
                return null;
            }

            @Override
            public Void visitNoType(NoType noType, Void unused) {
                return null;
            }

            @Override
            public Void visitPrimitive(PrimitiveType primitiveType, Void unused) {
                return null;
            }

            @Override
            public Void visitNull(NullType nullType, Void unused) {
                return null;
            }
        }, null);
    }

    public record ViewTypeInfo(String component, String bucket) {
    }
}
