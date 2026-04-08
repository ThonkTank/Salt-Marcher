package buildlogic.conventions.heuristic.owner

import com.sun.source.tree.ExpressionTree
import com.sun.source.tree.MemberSelectTree
import com.sun.source.tree.MethodInvocationTree
import javax.lang.model.element.Modifier

internal fun OwnerConventionSupport.isOwnerReachable(
    sourceOwnerPackage: String,
    targetOwnerPackage: String
): Boolean {
    return sourceOwnerPackage == targetOwnerPackage || sameOwnerEdgeOrNeighbor(sourceOwnerPackage, targetOwnerPackage)
}

internal fun OwnerConventionSupport.ownerPackageForTypeName(typeName: String): String {
    val typePackage = typeName.substringBeforeLast('.')
    val typeRole = roleForDirectoryName(typePackage.substringAfterLast('.'))
    return ownerPackageFor(typePackage, typeRole)
}

internal fun OwnerConventionSupport.declaredProjectTypeInRole(
    tree: com.sun.source.tree.Tree?,
    parsedSource: OwnerConventionParsedJavaSource,
    snapshot: OwnerConventionSnapshot,
    role: String
): String? {
    val typeName = declaredProjectTypeName(tree, parsedSource, snapshot) ?: return null
    val typePackage = typeName.substringBeforeLast('.')
    return typeName.takeIf { roleForDirectoryName(typePackage.substringAfterLast('.')) == role }
}

internal fun OwnerConventionSupport.declaredInputTypeName(
    tree: com.sun.source.tree.Tree?,
    parsedSource: OwnerConventionParsedJavaSource,
    snapshot: OwnerConventionSnapshot
): String? {
    return declaredProjectTypeInRole(tree, parsedSource, snapshot, inputRole)
}

internal fun OwnerConventionSupport.declaredStateTypeName(
    tree: com.sun.source.tree.Tree?,
    parsedSource: OwnerConventionParsedJavaSource,
    snapshot: OwnerConventionSnapshot
): String? {
    return declaredProjectTypeInRole(tree, parsedSource, snapshot, stateRole)
}

internal fun OwnerConventionSupport.isCanonicalOwnerRequestReturnType(
    tree: com.sun.source.tree.Tree?,
    parsedSource: OwnerConventionParsedJavaSource,
    snapshot: OwnerConventionSnapshot
): Boolean {
    if (tree == null || tree.toString() == "void") {
        return true
    }
    return declaredInputTypeName(tree, parsedSource, snapshot) != null
}

internal fun OwnerConventionSupport.isCanonicalOwnerRequestShape(
    method: OwnerConventionParsedJavaMethod,
    ownerPackage: String,
    parsedSource: OwnerConventionParsedJavaSource,
    snapshot: OwnerConventionSnapshot
): Boolean {
    val requestStem = requestStemForMethod(method.name) ?: return false
    if (Modifier.PUBLIC !in method.modifiers || Modifier.STATIC in method.modifiers) {
        return false
    }
    if (method.parameters.size != 1) {
        return false
    }
    val expectedInputType = "$ownerPackage.$inputRole.${requestStem}Input"
    val parameterType = declaredInputTypeName(method.parameters.single().tree.type, parsedSource, snapshot)
    if (parameterType != expectedInputType) {
        return false
    }
    return isCanonicalOwnerRequestReturnType(method.tree.returnType, parsedSource, snapshot)
}

internal fun OwnerConventionSupport.analyzeOwnerSurfaceShape(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot
): OwnerConventionAnalysis<OwnerConventionOwnerSurface> {
    val context = sourceFile.context
    val reasons = mutableListOf<String>()
    val siblingJavaFiles = directChildren(context.file.parentFile)
        .filter { child -> child.isFile && child.name.endsWith(".java") && child.name != "package-info.java" }
    if (!context.className.endsWith("Object.java")) {
        reasons += "${context.path} :: owner files must be named *Object"
    }
    if (normalizedToken(context.className.removeSuffix(".java").removeSuffix("Object")) != normalizedToken(context.dirName)) {
        reasons += "${context.path} :: owner file name must match its directory name"
    }
    if (siblingJavaFiles.size != 1 || siblingJavaFiles.single().canonicalFile != context.file.canonicalFile) {
        reasons += "${context.path} :: owner directories may contain exactly one Java file"
    }
    if (sourceFile.parsedSource.topLevelTypes.size != 1) {
        reasons += "${context.path} :: owner directories must expose exactly one top-level type"
    }
    val primaryType = parsedPrimaryType(sourceFile)
    if (primaryType == null) {
        reasons += "${context.path} :: owner files must declare a public final class named ${context.className.removeSuffix(".java")}"
        return OwnerConventionAnalysis(reasons = reasons.distinct(), model = null)
    }
    if (
        primaryType.kind != OwnerConventionParsedJavaTypeKind.CLASS ||
        Modifier.PUBLIC !in primaryType.modifiers ||
        Modifier.FINAL !in primaryType.modifiers
    ) {
        reasons += "${context.path} :: owner files must declare a public final class named ${context.className.removeSuffix(".java")}"
    }

    val ownerObjectTypeName = "${context.ownerPackage}.${primaryType.name}"
    reasons += validateOwnerDependencyTypes(
        context = context,
        snapshot = snapshot,
        support = this,
        sourceTypeName = ownerObjectTypeName,
        projectTypeNames = primaryType.fields.flatMap { field ->
            projectTypeNames(field.tree.type, sourceFile.parsedSource, snapshot)
        }.toSet(),
        reasonPrefix = "${context.path} :: owner fields"
    )
    reasons += validateOwnerDependencyTypes(
        context = context,
        snapshot = snapshot,
        support = this,
        sourceTypeName = ownerObjectTypeName,
        projectTypeNames = primaryType.constructors.flatMap { constructor ->
            constructor.parameters.flatMap { parameter ->
                projectTypeNames(parameter.tree.type, sourceFile.parsedSource, snapshot)
            }
        }.toSet(),
        reasonPrefix = "${context.path} :: owner constructors"
    )

    val publicMethods = primaryType.methods.filter { Modifier.PUBLIC in it.modifiers }
    publicMethods.groupBy { it.name }
        .filterValues { methods -> methods.size > 1 }
        .forEach { (methodName, _) ->
            reasons += "${context.path} :: owner requests must not overload $methodName"
        }
    primaryType.methods
        .filter { Modifier.PUBLIC !in it.modifiers }
        .forEach { method ->
            reasons += "${context.path} :: owner files must not declare helper methods like ${method.name}; only public request methods and constructors are allowed"
        }
    publicMethods.forEach { method ->
        reasons += ownerRequestShapeReasons(sourceFile, method, snapshot, this)
    }

    val requestMethodNames = publicMethods
        .filter { method -> ownerRequestShapeReasons(sourceFile, method, snapshot, this).isEmpty() }
        .map(OwnerConventionParsedJavaMethod::name)
        .toSet()
    val model = if (reasons.isEmpty() && requestMethodNames.isNotEmpty()) {
        OwnerConventionOwnerSurface(
            typeName = "${context.packageName}.${primaryType.name}",
            ownerPackage = context.ownerPackage,
            requestMethodNames = requestMethodNames,
            requestStems = requestMethodNames.mapNotNull(this::requestStemForMethod).toSet()
        )
    } else {
        null
    }
    return OwnerConventionAnalysis(
        reasons = reasons.distinct(),
        model = model
    )
}

internal fun OwnerConventionSupport.ownerSurfaceShape(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot
): OwnerConventionOwnerSurface? {
    return analyzeOwnerSurfaceShape(sourceFile, snapshot).model
}

internal fun OwnerConventionSupport.ownerCallerShape(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot
): OwnerConventionCanonicalOwnerCaller? {
    val ownerSurface = analyzeOwnerSurfaceShape(sourceFile, snapshot).model ?: return null
    return OwnerConventionCanonicalOwnerCaller(
        typeName = ownerSurface.typeName,
        ownerPackage = ownerSurface.ownerPackage,
        requestMethodNames = ownerSurface.requestMethodNames
    )
}

internal fun OwnerConventionSupport.analyzeInputShape(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot
): OwnerConventionAnalysis<OwnerConventionInputApi> {
    val context = sourceFile.context
    val reasons = mutableListOf<String>()
    val className = context.className.removeSuffix(".java")
    val requestStem = requestStemForFile(context.className, "Input")
    if (requestStem == null) {
        reasons += "${context.path} :: input files must be named <Request>Input with a direct request stem"
    } else if (requestStem !in snapshot.requestStemsByOwner[context.ownerPackage].orEmpty()) {
        reasons += "${context.path} :: input files must match a real public request on ${context.ownerPackage}.${ownerObjectName(context.ownerPackage)} that accepts exactly ${requestStem}Input"
    }
    val primaryType = parsedPrimaryType(sourceFile)
    if (primaryType == null) {
        reasons += "${context.path} :: input files must declare a top-level type named $className"
        return OwnerConventionAnalysis(reasons = reasons.distinct(), model = null)
    }
    val validKind = primaryType.kind == OwnerConventionParsedJavaTypeKind.RECORD ||
        primaryType.kind == OwnerConventionParsedJavaTypeKind.ENUM ||
        (primaryType.kind == OwnerConventionParsedJavaTypeKind.INTERFACE && Modifier.SEALED in primaryType.modifiers)
    if (!validKind) {
        reasons += "${context.path} :: input files must declare a record, enum, or sealed interface"
    }
    if (sourceFile.parsedSource.topLevelTypes.size != 1) {
        reasons += "${context.path} :: input files must contain exactly one top-level type"
    }
    reasons += inputMemberReasons(context.path, primaryType)
    context.typeImports.importedPackages.forEach { importedPackage ->
        if (roleForDirectoryName(importedPackage.substringAfterLast('.')) != inputRole) {
            reasons += "${context.path} -> $importedPackage :: input files may import only other input packages from project code"
        }
    }
    return OwnerConventionAnalysis(
        reasons = reasons.distinct(),
        model = if (reasons.isEmpty()) {
            OwnerConventionInputApi(
                typeName = "${context.packageName}.${primaryType.name}",
                ownerPackage = context.ownerPackage
            )
        } else {
            null
        }
    )
}

internal fun OwnerConventionSupport.inputApiShape(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot
): OwnerConventionInputApi? {
    return analyzeInputShape(sourceFile, snapshot).model
}

internal fun OwnerConventionSupport.analyzeTaskShape(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot
): OwnerConventionAnalysis<OwnerConventionStaticApi> {
    val context = sourceFile.context
    val reasons = mutableListOf<String>()
    val className = context.className.removeSuffix(".java")
    val requestStem = requestStemForFile(context.className, "Task")
    if (requestStem == null) {
        reasons += "${context.path} :: task files must be named <Request>Task with a direct request stem"
    } else if (requestStem !in snapshot.requestStemsByOwner[context.ownerPackage].orEmpty()) {
        reasons += "${context.path} :: task files must match a real public request on ${context.ownerPackage}.${ownerObjectName(context.ownerPackage)}"
    }
    val primaryType = parsedPrimaryType(sourceFile)
    if (primaryType == null) {
        reasons += "${context.path} :: task files must declare a top-level type named $className"
        return OwnerConventionAnalysis(reasons = reasons.distinct(), model = null)
    }
    if (sourceFile.parsedSource.topLevelTypes.size != 1) {
        reasons += "${context.path} :: task files must contain exactly one top-level type"
    }
    if (primaryType.kind != OwnerConventionParsedJavaTypeKind.CLASS || Modifier.FINAL !in primaryType.modifiers) {
        reasons += "${context.path} :: task files must declare a final class"
    }
    reasons += taskClassShapeReasons(context.path, primaryType)
    val constructors = primaryType.constructors
    if (constructors.none { Modifier.PRIVATE in it.modifiers } || constructors.any { Modifier.PUBLIC in it.modifiers }) {
        reasons += "${context.path} :: task files must hide construction behind a private constructor"
    }
    context.typeImports.importedPackages.forEach { importedPackage ->
        if (roleForDirectoryName(importedPackage.substringAfterLast('.')) != inputRole) {
            reasons += "${context.path} -> $importedPackage :: task files may import only input packages from project code"
        }
    }
    val publicStaticMethods = primaryType.methods.filter {
        Modifier.PUBLIC in it.modifiers && Modifier.STATIC in it.modifiers
    }
    val publicInstanceMethods = primaryType.methods.filter {
        Modifier.PUBLIC in it.modifiers && Modifier.STATIC !in it.modifiers
    }
    val instanceMethods = primaryType.methods.filter { Modifier.STATIC !in it.modifiers }
    if (publicStaticMethods.size != 1) {
        reasons += "${context.path} :: task files must expose exactly one public static method"
    }
    if (publicInstanceMethods.isNotEmpty()) {
        reasons += "${context.path} :: task files must not expose public instance methods"
    }
    if (instanceMethods.isNotEmpty()) {
        reasons += "${context.path} :: task files must stay static-only; all methods must be static"
    }
    publicStaticMethods.singleOrNull()?.let { method ->
        if (method.parameters.size != 1) {
            reasons += "${context.path} :: task files must model exactly one input parameter"
        }
        val parameterType = method.parameters.singleOrNull()?.let { parameter ->
            declaredInputTypeName(parameter.tree.type, sourceFile.parsedSource, snapshot)
        }
        val returnType = declaredInputTypeName(method.tree.returnType, sourceFile.parsedSource, snapshot)
        if (parameterType == null) {
            reasons += "${context.path} :: task methods must begin with exactly one canonical input type parameter"
        }
        if (requestStem != null) {
            val expectedInputType = "${context.ownerPackage}.$inputRole.${requestStem}Input"
            if (parameterType != expectedInputType) {
                reasons += "${context.path} :: task methods must accept exactly ${requestStem}Input from the same owner"
            }
        }
        if (returnType == null) {
            reasons += "${context.path} :: task methods must end with exactly one canonical input return type"
        } else if (!isOwnerReachable(context.ownerPackage, ownerPackageForTypeName(returnType))) {
            reasons += "${context.path} :: task methods may return only same-owner or neighboring input types"
        }
    }
    return OwnerConventionAnalysis(
        reasons = reasons.distinct(),
        model = if (reasons.isEmpty()) {
            OwnerConventionStaticApi(
                typeName = "${context.packageName}.${primaryType.name}",
                ownerPackage = context.ownerPackage,
                publicStaticMethodNames = setOf(publicStaticMethods.single().name)
            )
        } else {
            null
        }
    )
}

internal fun OwnerConventionSupport.taskApiShape(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot
): OwnerConventionStaticApi? {
    return analyzeTaskShape(sourceFile, snapshot).model
}

internal fun OwnerConventionSupport.analyzeStateShape(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot
): OwnerConventionAnalysis<OwnerConventionStaticApi> {
    val context = sourceFile.context
    val reasons = mutableListOf<String>()
    val className = context.className.removeSuffix(".java")
    val primaryType = parsedPrimaryType(sourceFile)
    if (primaryType == null) {
        reasons += "${context.path} :: state files must declare a top-level type named $className"
        return OwnerConventionAnalysis(reasons = reasons.distinct(), model = null)
    }
    if (sourceFile.parsedSource.topLevelTypes.size != 1) {
        reasons += "${context.path} :: state files must contain exactly one top-level type"
    }
    val validKind = primaryType.kind == OwnerConventionParsedJavaTypeKind.RECORD ||
        primaryType.kind == OwnerConventionParsedJavaTypeKind.ENUM ||
        (primaryType.kind == OwnerConventionParsedJavaTypeKind.CLASS && Modifier.FINAL in primaryType.modifiers)
    if (!validKind) {
        reasons += "${context.path} :: state files must declare a final class, record, or enum"
    }
    if (
        primaryType.kind == OwnerConventionParsedJavaTypeKind.CLASS &&
        primaryType.constructors.any { Modifier.PUBLIC in it.modifiers }
    ) {
        reasons += "${context.path} :: state classes must use factory or transition methods instead of public constructors"
    }
    context.typeImports.importedPackages.forEach { importedPackage ->
        val importedRole = roleForDirectoryName(importedPackage.substringAfterLast('.'))
        val allowed = sameOwner(context.ownerPackage, importedPackage) &&
            importedRole in setOf(inputRole, stateRole)
        if (!allowed) {
            reasons += "${context.path} -> $importedPackage :: state files may import only own input and own state packages"
        }
    }
    val publicMethods = primaryType.methods.filter { Modifier.PUBLIC in it.modifiers }
    if (publicMethods.any { Modifier.STATIC !in it.modifiers }) {
        reasons += "${context.path} :: state files must not expose public instance methods"
    }
    publicMethods
        .filter { Modifier.STATIC in it.modifiers }
        .forEach { method ->
            val parameterPackages = method.parameters.flatMap { parameter ->
                projectTypePackages(parameter.tree.type, sourceFile.parsedSource, snapshot)
            }.distinct()
            val returnPackages = projectTypePackages(method.tree.returnType, sourceFile.parsedSource, snapshot)
            if (parameterPackages.any { projectPackage ->
                    !sameOwner(context.ownerPackage, projectPackage) ||
                        roleForDirectoryName(projectPackage.substringAfterLast('.')) !in setOf(inputRole, stateRole)
                }
            ) {
                reasons += "${context.path} :: state factories may accept only own input and own state types"
            }
            if (returnPackages.any { projectPackage ->
                    !sameOwner(context.ownerPackage, projectPackage) ||
                        roleForDirectoryName(projectPackage.substringAfterLast('.')) != stateRole
                }
            ) {
                reasons += "${context.path} :: state factories may return only own state types"
            }
        }
    val publicStaticMethodNames = publicMethods
        .filter { method -> Modifier.STATIC in method.modifiers }
        .map(OwnerConventionParsedJavaMethod::name)
        .toSet()
    return OwnerConventionAnalysis(
        reasons = reasons.distinct(),
        model = if (reasons.isEmpty() && publicStaticMethodNames.isNotEmpty()) {
            OwnerConventionStaticApi(
                typeName = "${context.packageName}.${primaryType.name}",
                ownerPackage = context.ownerPackage,
                publicStaticMethodNames = publicStaticMethodNames
            )
        } else {
            null
        }
    )
}

internal fun OwnerConventionSupport.stateApiShape(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot
): OwnerConventionStaticApi? {
    return analyzeStateShape(sourceFile, snapshot).model
}

internal fun OwnerConventionSupport.analyzeRepositoryShape(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot
): OwnerConventionAnalysis<OwnerConventionStaticApi> {
    val context = sourceFile.context
    val reasons = mutableListOf<String>()
    val className = context.className.removeSuffix(".java")
    val primaryType = parsedPrimaryType(sourceFile)
    if (primaryType == null) {
        reasons += "${context.path} :: repository files must declare a top-level type named $className"
        return OwnerConventionAnalysis(reasons = reasons.distinct(), model = null)
    }
    if (sourceFile.parsedSource.topLevelTypes.size != 1) {
        reasons += "${context.path} :: repository files must contain exactly one top-level type"
    }
    if (primaryType.kind != OwnerConventionParsedJavaTypeKind.CLASS || Modifier.FINAL !in primaryType.modifiers) {
        reasons += "${context.path} :: repository files must declare a final class"
    }
    reasons += repositoryClassShapeReasons(context.path, primaryType)
    if (
        primaryType.constructors.none { Modifier.PRIVATE in it.modifiers } ||
        primaryType.constructors.any { Modifier.PUBLIC in it.modifiers }
    ) {
        reasons += "${context.path} :: repository files must hide construction behind a private constructor"
    }
    context.typeImports.importedPackages.forEach { importedPackage ->
        val importedRole = roleForDirectoryName(importedPackage.substringAfterLast('.'))
        val allowed = sameOwner(context.ownerPackage, importedPackage) && importedRole == stateRole
        if (!allowed) {
            reasons += "${context.path} -> $importedPackage :: repository files may import only own state packages from project code"
        }
    }
    val publicMethods = primaryType.methods.filter { Modifier.PUBLIC in it.modifiers }
    if (publicMethods.none { Modifier.STATIC in it.modifiers }) {
        reasons += "${context.path} :: repository files must expose public static persistence methods"
    }
    if (publicMethods.any { Modifier.STATIC !in it.modifiers }) {
        reasons += "${context.path} :: repository files must not expose public instance methods"
    }
    publicMethods
        .filter { Modifier.STATIC in it.modifiers }
        .forEach { method ->
            val parameterPackages = method.parameters.flatMap { parameter ->
                projectTypePackages(parameter.tree.type, sourceFile.parsedSource, snapshot)
            }.distinct()
            val returnPackages = projectTypePackages(method.tree.returnType, sourceFile.parsedSource, snapshot)
            val stateTypesExposed = (parameterPackages + returnPackages).any { projectPackage ->
                sameOwner(context.ownerPackage, projectPackage) &&
                    roleForDirectoryName(projectPackage.substringAfterLast('.')) == stateRole
            }
            if (parameterPackages.any { projectPackage ->
                    !sameOwner(context.ownerPackage, projectPackage) ||
                        roleForDirectoryName(projectPackage.substringAfterLast('.')) != stateRole
                }
            ) {
                reasons += "${context.path} :: repository methods may accept only own state types from project code"
            }
            if (returnPackages.any { projectPackage ->
                    !sameOwner(context.ownerPackage, projectPackage) ||
                        roleForDirectoryName(projectPackage.substringAfterLast('.')) != stateRole
                }
            ) {
                reasons += "${context.path} :: repository methods may return only own state types from project code"
            }
            if (!stateTypesExposed) {
                reasons += "${context.path} :: repository methods must expose at least one own state type in parameters or return position"
            }
        }
    val publicStaticMethodNames = publicMethods
        .filter { method -> Modifier.STATIC in method.modifiers }
        .map(OwnerConventionParsedJavaMethod::name)
        .toSet()
    return OwnerConventionAnalysis(
        reasons = reasons.distinct(),
        model = if (reasons.isEmpty() && publicStaticMethodNames.isNotEmpty()) {
            OwnerConventionStaticApi(
                typeName = "${context.packageName}.${primaryType.name}",
                ownerPackage = context.ownerPackage,
                publicStaticMethodNames = publicStaticMethodNames
            )
        } else {
            null
        }
    )
}

internal fun OwnerConventionSupport.repositoryApiShape(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot
): OwnerConventionStaticApi? {
    return analyzeRepositoryShape(sourceFile, snapshot).model
}

internal fun isAllowedObjectsUtilityInvocation(
    invocation: MethodInvocationTree,
    argumentAllowed: (ExpressionTree) -> Boolean
): Boolean {
    val methodSelect = invocation.methodSelect as? MemberSelectTree ?: return false
    val receiverText = methodSelect.expression.toString()
    if (receiverText !in setOf("Objects", "java.util.Objects")) {
        return false
    }
    val arguments = invocation.arguments
    return when (methodSelect.identifier.toString()) {
        "requireNonNull" -> arguments.size in setOf(1, 2) && arguments.all(argumentAllowed)
        "equals" -> arguments.size == 2 && arguments.all(argumentAllowed)
        "isNull", "nonNull" -> arguments.size == 1 && arguments.all(argumentAllowed)
        else -> false
    }
}
