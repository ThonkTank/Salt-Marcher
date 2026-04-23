package saltmarcher.quality.errorprone;

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
import javax.lang.model.util.SimpleTypeVisitor14;

final class ViewArchitectureSupport {

    static final Pattern VIEW_CONTRIBUTION_PACKAGE = Pattern.compile("^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$");
    static final Pattern VIEW_MODEL_PACKAGE = Pattern.compile("^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$|^src\\.view\\.slotcontent\\.(controls|main|state|details|topbar)\\.[^.]+$");
    static final Pattern VIEW_PANEL_PACKAGE = Pattern.compile("^src\\.view\\.slotcontent\\.(controls|main|state|details|topbar)\\.[^.]+$|^src\\.view\\.primitives\\.[^.]+$");
    static final Pattern VIEW_SLOT_PACKAGE = Pattern.compile("^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$");
    static final Pattern LEGACY_VIEW_PACKAGE = Pattern.compile("^src\\.view\\.(?!(leftbartabs|statetabs|dropdowns|slotcontent|primitives)(\\.|$)).+");
    static final Pattern DATA_ROOT_PACKAGE = Pattern.compile("^src\\.data\\.([^.]+)$");

    private static final Set<String> CONTRIBUTION_ALLOWED_SHELL_TYPES = Set.of(
            "shell.api.ContributionKey",
            "shell.api.InspectorEntrySpec",
            "shell.api.InspectorSink",
            "shell.api.NavigationGraphicResource",
            "shell.api.NavigationGroupSpec",
            "shell.api.ShellBinding",
            "shell.api.ShellContribution",
            "shell.api.ShellContributionSpec",
            "shell.api.ShellRuntimeContext",
            "shell.api.ShellStateTabSpec",
            "shell.api.ShellLeftBarTabMode",
            "shell.api.ShellLeftBarTabSpec",
            "shell.api.ShellTopBarSpec");
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
    private static final Set<String> INSPECTOR_ENTRY_ALLOWED_SHELL_TYPES = Set.of(
            "shell.api.InspectorEntrySpec");
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

    static String packageName(CompilationUnitTree tree) {
        return tree.getPackageName() == null ? "" : tree.getPackageName().toString();
    }

    static boolean isContributionSource(CompilationUnitTree tree) {
        return VIEW_CONTRIBUTION_PACKAGE.matcher(packageName(tree)).matches()
                && sourceFileName(tree).endsWith("Contribution.java");
    }

    static boolean isBinderSource(CompilationUnitTree tree) {
        return VIEW_CONTRIBUTION_PACKAGE.matcher(packageName(tree)).matches()
                && sourceFileName(tree).endsWith("Binder.java");
    }

    static boolean isViewModelSource(CompilationUnitTree tree) {
        return VIEW_MODEL_PACKAGE.matcher(packageName(tree)).matches()
                && sourceFileName(tree).endsWith("ViewModel.java");
    }

    static boolean isInspectorEntrySource(CompilationUnitTree tree) {
        return VIEW_MODEL_PACKAGE.matcher(packageName(tree)).matches()
                && sourceFileName(tree).endsWith("InspectorEntry.java");
    }

    static boolean isPanelViewSource(CompilationUnitTree tree) {
        String packageName = packageName(tree);
        String sourceFileName = sourceFileName(tree);
        return (VIEW_PANEL_PACKAGE.matcher(packageName).matches()
                || VIEW_SLOT_PACKAGE.matcher(packageName).matches())
                && sourceFileName.endsWith("View.java")
                && !sourceFileName.endsWith("ViewModel.java");
    }

    private static String sourceFileName(CompilationUnitTree tree) {
        if (tree.getSourceFile() == null) {
            return "";
        }
        String name = tree.getSourceFile().getName().replace('\\', '/');
        int separator = name.lastIndexOf('/');
        return separator < 0 ? name : name.substring(separator + 1);
    }

    static Set<String> collectReferencedTypes(CompilationUnitTree tree) {
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

    static void collectReferencedTypes(Tree tree, Set<String> referencedTypes) {
        Symbol symbol = ASTHelpers.getSymbol(tree);
        if (symbol != null) {
            addReference(getQualifiedTypeName(symbol), referencedTypes);
            addReference(getQualifiedOwnerTypeName(symbol), referencedTypes);
        }
        collectTypeReferences(ASTHelpers.getType(tree), referencedTypes);
    }

    static void addReference(String qualifiedName, Set<String> referencedTypes) {
        if (qualifiedName != null && !qualifiedName.isBlank()) {
            referencedTypes.add(qualifiedName);
        }
    }

    static String getQualifiedTypeName(Symbol symbol) {
        if (symbol instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        if (symbol != null && symbol.type != null && symbol.type.tsym instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }

    static String getQualifiedOwnerTypeName(Symbol symbol) {
        if (symbol == null || symbol.owner == null) {
            return null;
        }
        if (symbol.owner instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        return null;
    }

    static boolean isAllowedViewModelDomainBoundary(String referencedType) {
        return isDomainApplicationServiceRoot(referencedType)
                || referencedType.matches("^src\\.domain\\.[^.]+\\.published\\..+");
    }

    private static boolean isDomainApplicationServiceRoot(String referencedType) {
        return referencedType.matches("^src\\.domain\\.[^.]+\\.[^.]+ApplicationService((\\$|\\.).*)?$");
    }

    static boolean isAllowedViewModelJavafxType(String referencedType) {
        return referencedType.startsWith("javafx.beans.")
                || referencedType.startsWith("javafx.collections.");
    }

    static boolean isAllowedModelJavafxType(String referencedType) {
        return isAllowedViewModelJavafxType(referencedType)
                || referencedType.equals("javafx.scene.Node");
    }

    static boolean isForbiddenViewInfrastructureJdkType(String referencedType) {
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

    static boolean isTargetViewModelReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null && "MODEL".equals(viewType.bucket());
    }

    static boolean isTargetPanelViewReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null && "VIEW".equals(viewType.bucket());
    }

    static ViewTypeInfo parseViewType(String referencedType) {
        if (referencedType == null || !referencedType.startsWith("src.view.")) {
            return null;
        }
        String remainder = referencedType.substring("src.view.".length());
        String[] segments = remainder.split("\\.");
        if (segments.length == 0) {
            return new ViewTypeInfo("VIEW_ROOT", "LEGACY");
        }
        if ("slotcontent".equals(segments[0]) && segments.length >= 4) {
            String topLevelSimpleName = segments[3].replaceFirst("\\$.*$", "");
            if (topLevelSimpleName.endsWith("DisplayModel")) {
                return new ViewTypeInfo(segments[1], "MODEL");
            }
            if (topLevelSimpleName.endsWith("ViewModel")) {
                return new ViewTypeInfo(segments[1], "MODEL");
            }
            if (topLevelSimpleName.endsWith("InspectorEntry")) {
                return new ViewTypeInfo(segments[1], "INSPECTOR_ENTRY");
            }
            return new ViewTypeInfo(segments[1], "VIEW");
        }
        if ("primitives".equals(segments[0]) && segments.length >= 3) {
            return new ViewTypeInfo(segments[0], "VIEW");
        }
        if (Set.of("leftbartabs", "statetabs", "dropdowns").contains(segments[0]) && segments.length >= 3) {
            for (int index = 2; index < segments.length; index++) {
                String simpleName = segments[index].replaceFirst("\\$.*$", "");
                if (simpleName.endsWith("Contribution")) {
                    return new ViewTypeInfo(segments[0], "CONTRIBUTION");
                }
                if (simpleName.endsWith("Binder")) {
                    return new ViewTypeInfo(segments[0], "BINDER");
                }
                if (simpleName.endsWith("ViewModel")) {
                    return new ViewTypeInfo(segments[0], "MODEL");
                }
                if (simpleName.endsWith("View")) {
                    return new ViewTypeInfo(segments[0], "VIEW");
                }
            }
        }
        return new ViewTypeInfo(segments[0], "LEGACY");
    }

    static boolean isLegacyViewReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null && "LEGACY".equals(viewType.bucket());
    }

    static boolean isSameViewRootReference(String sourcePackageName, String referencedType) {
        return packageNameOf(referencedType).equals(sourcePackageName);
    }

    static boolean isReusablePassiveViewReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null
                && (Set.of("controls", "main", "state", "details", "topbar").contains(viewType.component())
                || "primitives".equals(viewType.component()))
                && "VIEW".equals(viewType.bucket());
    }

    static boolean isReusableDisplayModelReference(String referencedType) {
        if (referencedType != null
                && referencedType.matches("^src\\.view\\.slotcontent\\.(controls|main|state|details|topbar)\\.[^.]+\\.[A-Z][A-Za-z0-9_]*DisplayModel(?:[.$].*)?$")) {
            return true;
        }
        return false;
    }

    static boolean isSlotcontentInspectorEntryReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null
                && Set.of("controls", "main", "state", "details", "topbar").contains(viewType.component())
                && "INSPECTOR_ENTRY".equals(viewType.bucket());
    }

    static boolean isSlotcontentModelReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null
                && Set.of("controls", "main", "state", "details", "topbar").contains(viewType.component())
                && "MODEL".equals(viewType.bucket());
    }

    static boolean isDetailEntryViewReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null
                && "details".equals(viewType.component())
                && "VIEW".equals(viewType.bucket());
    }

    static boolean isDetailEntryViewModelReference(String referencedType) {
        ViewTypeInfo viewType = parseViewType(referencedType);
        return viewType != null
                && "details".equals(viewType.component())
                && "MODEL".equals(viewType.bucket());
    }

    static boolean isDetailEntryReference(String referencedType) {
        return isDetailEntryViewReference(referencedType)
                || isDetailEntryViewModelReference(referencedType)
                || isSlotcontentInspectorEntryReference(referencedType);
    }

    static boolean isSameViewRootOrReusablePassiveViewReference(String sourcePackageName, String referencedType) {
        return isSameViewRootReference(sourcePackageName, referencedType)
                || isReusablePassiveViewReference(referencedType);
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
            if (segments.length >= 5 && "primitives".equals(segments[2])) {
                return String.join(".", segments[0], segments[1], segments[2], segments[3]);
            }
            if (segments.length >= 4 && Set.of("leftbartabs", "statetabs", "dropdowns").contains(segments[2])) {
                return String.join(".", segments[0], segments[1], segments[2], segments[3]);
            }
        }
        int separator = topLevelType.lastIndexOf('.');
        return separator < 0 ? "" : topLevelType.substring(0, separator);
    }

    static boolean isAllowedContributionShellType(String referencedType) {
        return isAllowedShellType(referencedType, CONTRIBUTION_ALLOWED_SHELL_TYPES);
    }

    static boolean isAllowedBinderShellType(String referencedType) {
        return isAllowedShellType(referencedType, BINDER_ALLOWED_SHELL_TYPES);
    }

    static boolean isAllowedDataRootShellType(String referencedType) {
        return isAllowedShellType(referencedType, DATA_ROOT_ALLOWED_SHELL_TYPES);
    }

    static boolean isAllowedInspectorEntryShellType(String referencedType) {
        return isAllowedShellType(referencedType, INSPECTOR_ENTRY_ALLOWED_SHELL_TYPES);
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

    private static void collectTypeReferences(TypeMirror typeMirror, Set<String> referencedTypes) {
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

    record ViewTypeInfo(String component, String bucket) {
    }
}
