package buildlogic.conventions.heuristic.owner

import com.sun.source.tree.ExpressionTree
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

internal fun OwnerConventionSupport.ownerSurfaceShape(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot
): OwnerConventionOwnerSurface? {
    val context = sourceFile.context
    if (context.role != ownerRole || !context.className.endsWith("Object.java")) {
        return null
    }
    val primaryType = parsedPrimaryType(sourceFile) ?: return null
    if (
        primaryType.kind != OwnerConventionParsedJavaTypeKind.CLASS ||
        Modifier.PUBLIC !in primaryType.modifiers ||
        Modifier.FINAL !in primaryType.modifiers
    ) {
        return null
    }
    val requestMethodNames = primaryType.methods
        .filter { method ->
            isCanonicalOwnerRequestShape(
                method = method,
                ownerPackage = context.ownerPackage,
                parsedSource = sourceFile.parsedSource,
                snapshot = snapshot
            )
        }
        .map(OwnerConventionParsedJavaMethod::name)
        .toSet()
    if (requestMethodNames.isEmpty()) {
        return null
    }
    return OwnerConventionOwnerSurface(
        typeName = "${context.packageName}.${primaryType.name}",
        ownerPackage = context.ownerPackage,
        requestMethodNames = requestMethodNames,
        requestStems = requestMethodNames.mapNotNull(this::requestStemForMethod).toSet()
    )
}

internal fun OwnerConventionSupport.ownerCallerShape(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot
): OwnerConventionCanonicalOwnerCaller? {
    val ownerSurface = ownerSurfaceShape(sourceFile, snapshot) ?: return null
    return OwnerConventionCanonicalOwnerCaller(
        typeName = ownerSurface.typeName,
        ownerPackage = ownerSurface.ownerPackage,
        requestMethodNames = ownerSurface.requestMethodNames
    )
}

internal fun OwnerConventionSupport.inputApiShape(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot
): OwnerConventionInputApi? {
    val context = sourceFile.context
    val requestStem = requestStemForFile(context.className, "Input") ?: return null
    if (requestStem !in snapshot.requestStemsByOwner[context.ownerPackage].orEmpty()) {
        return null
    }
    val primaryType = parsedPrimaryType(sourceFile) ?: return null
    val validKind = primaryType.kind == OwnerConventionParsedJavaTypeKind.RECORD ||
        primaryType.kind == OwnerConventionParsedJavaTypeKind.ENUM ||
        (primaryType.kind == OwnerConventionParsedJavaTypeKind.INTERFACE && Modifier.SEALED in primaryType.modifiers)
    if (!validKind) {
        return null
    }
    return OwnerConventionInputApi(
        typeName = "${context.packageName}.${primaryType.name}",
        ownerPackage = context.ownerPackage
    )
}

internal fun OwnerConventionSupport.taskApiShape(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot
): OwnerConventionStaticApi? {
    val context = sourceFile.context
    val requestStem = requestStemForFile(context.className, "Task") ?: return null
    if (requestStem !in snapshot.requestStemsByOwner[context.ownerPackage].orEmpty()) {
        return null
    }
    val primaryType = parsedPrimaryType(sourceFile) ?: return null
    if (primaryType.kind != OwnerConventionParsedJavaTypeKind.CLASS) {
        return null
    }
    val expectedInputType = "${context.ownerPackage}.$inputRole.${requestStem}Input"
    val methodNames = primaryType.methods
        .filter { method ->
            Modifier.PUBLIC in method.modifiers &&
                Modifier.STATIC in method.modifiers &&
                method.parameters.size == 1 &&
                declaredInputTypeName(method.parameters.single().tree.type, sourceFile.parsedSource, snapshot) == expectedInputType &&
                declaredInputTypeName(method.tree.returnType, sourceFile.parsedSource, snapshot)?.let { returnType ->
                    isOwnerReachable(context.ownerPackage, ownerPackageForTypeName(returnType))
                } == true
        }
        .map(OwnerConventionParsedJavaMethod::name)
        .toSet()
    if (methodNames.isEmpty()) {
        return null
    }
    return OwnerConventionStaticApi(
        typeName = "${context.packageName}.${primaryType.name}",
        ownerPackage = context.ownerPackage,
        publicStaticMethodNames = methodNames
    )
}

internal fun OwnerConventionSupport.stateApiShape(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot
): OwnerConventionStaticApi? {
    val context = sourceFile.context
    val primaryType = parsedPrimaryType(sourceFile) ?: return null
    val methodNames = primaryType.methods
        .filter { method ->
            Modifier.PUBLIC in method.modifiers &&
                Modifier.STATIC in method.modifiers &&
                method.parameters.flatMap { parameter ->
                    projectTypePackages(parameter.tree.type, sourceFile.parsedSource, snapshot)
                }.all { projectPackage ->
                    sameOwner(context.ownerPackage, projectPackage) &&
                        roleForDirectoryName(projectPackage.substringAfterLast('.')) in setOf(inputRole, stateRole)
                } &&
                declaredStateTypeName(method.tree.returnType, sourceFile.parsedSource, snapshot)?.let { returnType ->
                    ownerPackageForTypeName(returnType) == context.ownerPackage
                } == true
        }
        .map(OwnerConventionParsedJavaMethod::name)
        .toSet()
    if (methodNames.isEmpty()) {
        return null
    }
    return OwnerConventionStaticApi(
        typeName = "${context.packageName}.${primaryType.name}",
        ownerPackage = context.ownerPackage,
        publicStaticMethodNames = methodNames
    )
}

internal fun OwnerConventionSupport.repositoryApiShape(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot
): OwnerConventionStaticApi? {
    val context = sourceFile.context
    val primaryType = parsedPrimaryType(sourceFile) ?: return null
    val methodNames = primaryType.methods
        .filter { method ->
            if (Modifier.PUBLIC !in method.modifiers || Modifier.STATIC !in method.modifiers) {
                return@filter false
            }
            val parameterPackages = method.parameters.flatMap { parameter ->
                projectTypePackages(parameter.tree.type, sourceFile.parsedSource, snapshot)
            }
            val returnType = declaredStateTypeName(method.tree.returnType, sourceFile.parsedSource, snapshot)
            val returnPackages = projectTypePackages(method.tree.returnType, sourceFile.parsedSource, snapshot)
            val stateTypesExposed = parameterPackages.any { projectPackage ->
                sameOwner(context.ownerPackage, projectPackage) &&
                    roleForDirectoryName(projectPackage.substringAfterLast('.')) == stateRole
            } || (returnType != null && ownerPackageForTypeName(returnType) == context.ownerPackage)
            parameterPackages.all { projectPackage ->
                sameOwner(context.ownerPackage, projectPackage) &&
                    roleForDirectoryName(projectPackage.substringAfterLast('.')) == stateRole
            } &&
                returnPackages.all { projectPackage ->
                    sameOwner(context.ownerPackage, projectPackage) &&
                        roleForDirectoryName(projectPackage.substringAfterLast('.')) == stateRole
                } &&
                stateTypesExposed
        }
        .map(OwnerConventionParsedJavaMethod::name)
        .toSet()
    if (methodNames.isEmpty()) {
        return null
    }
    return OwnerConventionStaticApi(
        typeName = "${context.packageName}.${primaryType.name}",
        ownerPackage = context.ownerPackage,
        publicStaticMethodNames = methodNames
    )
}

internal fun isAllowedObjectsUtilityInvocation(
    invocation: MethodInvocationTree,
    argumentAllowed: (ExpressionTree) -> Boolean
): Boolean {
    val methodSelect = invocation.methodSelect as? com.sun.source.tree.MemberSelectTree ?: return false
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
