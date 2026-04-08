package buildlogic.conventions.heuristic.owner

import javax.lang.model.element.Modifier

internal data class OwnerConventionStaticApi(
    val typeName: String,
    val ownerPackage: String,
    val publicStaticMethodNames: Set<String>
)

internal data class OwnerConventionCatalog(
    val ownerObjectTypeNamesByOwner: Map<String, String>,
    val ownerRequestMethodNamesByOwner: Map<String, Set<String>>,
    val requestStemsByOwner: Map<String, Set<String>>,
    val taskApisByTypeName: Map<String, OwnerConventionStaticApi>,
    val stateApisByTypeName: Map<String, OwnerConventionStaticApi>,
    val repositoryApisByTypeName: Map<String, OwnerConventionStaticApi>
) {
    companion object {
        val EMPTY = OwnerConventionCatalog(
            ownerObjectTypeNamesByOwner = emptyMap(),
            ownerRequestMethodNamesByOwner = emptyMap(),
            requestStemsByOwner = emptyMap(),
            taskApisByTypeName = emptyMap(),
            stateApisByTypeName = emptyMap(),
            repositoryApisByTypeName = emptyMap()
        )
    }
}

internal fun OwnerConventionSupport.buildOwnerConventionCatalog(
    snapshot: OwnerConventionSnapshot,
    parsedSourcesByPath: Map<String, OwnerConventionParsedJavaSource>,
    knownPackages: Set<String>,
    knownTypeNames: Set<String>
): OwnerConventionCatalog {
    val ownerObjectTypeNamesByOwner = linkedMapOf<String, String>()
    val ownerRequestMethodNamesByOwner = linkedMapOf<String, Set<String>>()
    val requestStemsByOwner = linkedMapOf<String, Set<String>>()

    parsedSourcesByPath.values.forEach { parsedSource ->
        val packageName = parsedSource.packageName ?: return@forEach
        val role = roleForDirectoryName(parsedSource.file.parentFile.name)
        if (role != ownerRole || !parsedSource.file.name.endsWith("Object.java")) {
            return@forEach
        }
        val primaryType = parsedSource.topLevelTypes.firstOrNull { type -> type.name == parsedSource.file.nameWithoutExtension }
            ?: return@forEach
        if (
            parsedSource.topLevelTypes.size != 1 ||
            primaryType.kind != OwnerConventionParsedJavaTypeKind.CLASS ||
            Modifier.PUBLIC !in primaryType.modifiers ||
            Modifier.FINAL !in primaryType.modifiers
        ) {
            return@forEach
        }
        val ownerPackage = ownerPackageFor(packageName, role)
        val requestMethods = primaryType.methods
            .filter { method ->
                isCanonicalOwnerRequestShape(
                    method = method,
                    ownerPackage = ownerPackage,
                    parsedSource = parsedSource,
                    snapshot = snapshot
                )
            }
            .map { method -> method.name }
            .toSet()
        ownerObjectTypeNamesByOwner[ownerPackage] = "$packageName.${primaryType.name}"
        ownerRequestMethodNamesByOwner[ownerPackage] = requestMethods
        requestStemsByOwner[ownerPackage] = requestMethods
            .mapNotNull(::requestStemForMethod)
            .toSet()
    }

    return OwnerConventionCatalog(
        ownerObjectTypeNamesByOwner = ownerObjectTypeNamesByOwner,
        ownerRequestMethodNamesByOwner = ownerRequestMethodNamesByOwner,
        requestStemsByOwner = requestStemsByOwner,
        taskApisByTypeName = buildStaticApisByTypeName(
            parsedSourcesByPath = parsedSourcesByPath,
            knownPackages = knownPackages,
            knownTypeNames = knownTypeNames,
            role = taskRole
        ) { parsedSource, _, ownerPackage, primaryType, _ ->
            canonicalTaskApi(
                parsedSource = parsedSource,
                ownerPackage = ownerPackage,
                primaryType = primaryType,
                snapshot = snapshot,
                requestStemsByOwner = requestStemsByOwner
            )
        },
        stateApisByTypeName = buildStaticApisByTypeName(
            parsedSourcesByPath = parsedSourcesByPath,
            knownPackages = knownPackages,
            knownTypeNames = knownTypeNames,
            role = stateRole
        ) { parsedSource, _, ownerPackage, primaryType, _ ->
            canonicalStateApi(
                parsedSource = parsedSource,
                ownerPackage = ownerPackage,
                primaryType = primaryType,
                snapshot = snapshot
            )
        },
        repositoryApisByTypeName = buildStaticApisByTypeName(
            parsedSourcesByPath = parsedSourcesByPath,
            knownPackages = knownPackages,
            knownTypeNames = knownTypeNames,
            role = repositoryRole
        ) { parsedSource, _, ownerPackage, primaryType, _ ->
            canonicalRepositoryApi(
                parsedSource = parsedSource,
                ownerPackage = ownerPackage,
                primaryType = primaryType,
                snapshot = snapshot
            )
        }
    )
}

private fun OwnerConventionSupport.buildStaticApisByTypeName(
    parsedSourcesByPath: Map<String, OwnerConventionParsedJavaSource>,
    knownPackages: Set<String>,
    knownTypeNames: Set<String>,
    role: String,
    apiBuilder: (
        parsedSource: OwnerConventionParsedJavaSource,
        packageName: String,
        ownerPackage: String,
        primaryType: OwnerConventionParsedJavaType,
        typeImports: OwnerConventionTypeImports
    ) -> OwnerConventionStaticApi?
): Map<String, OwnerConventionStaticApi> {
    return parsedSourcesByPath.values
        .mapNotNull { parsedSource ->
            val packageName = parsedSource.packageName ?: return@mapNotNull null
            if (roleForDirectoryName(parsedSource.file.parentFile.name) != role) {
                return@mapNotNull null
            }
            val primaryType = parsedSource.topLevelTypes.firstOrNull { type -> type.name == parsedSource.file.nameWithoutExtension }
                ?: return@mapNotNull null
            val typeImports = typeImportsFor(parsedSource.importDeclarations, knownPackages)
            val ownerPackage = ownerPackageFor(packageName, role)
            apiBuilder(parsedSource, packageName, ownerPackage, primaryType, typeImports)
        }
        .associateBy(OwnerConventionStaticApi::typeName)
}

private fun OwnerConventionSupport.canonicalTaskApi(
    parsedSource: OwnerConventionParsedJavaSource,
    ownerPackage: String,
    primaryType: OwnerConventionParsedJavaType,
    snapshot: OwnerConventionSnapshot,
    requestStemsByOwner: Map<String, Set<String>>
): OwnerConventionStaticApi? {
    val packageName = parsedSource.packageName ?: return null
    if (
        parsedSource.topLevelTypes.size != 1 ||
        primaryType.kind != OwnerConventionParsedJavaTypeKind.CLASS ||
        Modifier.FINAL !in primaryType.modifiers
    ) {
        return null
    }
    if (
        primaryType.constructors.none { Modifier.PRIVATE in it.modifiers } ||
        primaryType.constructors.any { Modifier.PUBLIC in it.modifiers }
    ) {
        return null
    }
    val requestStem = requestStemForFile(parsedSource.file.name, "Task") ?: return null
    if (requestStem !in requestStemsByOwner[ownerPackage].orEmpty()) {
        return null
    }
    val publicMethods = primaryType.methods.filter { Modifier.PUBLIC in it.modifiers }
    val publicStaticMethods = publicMethods.filter { Modifier.STATIC in it.modifiers }
    if (publicStaticMethods.size != 1 || publicMethods.any { Modifier.STATIC !in it.modifiers }) {
        return null
    }
    val method = publicStaticMethods.single()
    if (method.parameters.size != 1) {
        return null
    }
    val parameterTypes = method.parameters.flatMap { parameter ->
        projectTypeNames(parameter.tree.type, parsedSource, snapshot)
    }.distinct()
    val returnPackages = projectTypePackages(method.tree.returnType, parsedSource, snapshot)
    val expectedInputType = "$ownerPackage.$inputRole.${requestStem}Input"
    if (parameterTypes != listOf(expectedInputType)) {
        return null
    }
    if (returnPackages.size != 1 || returnPackages.any { projectPackage ->
            roleForDirectoryName(projectPackage.substringAfterLast('.')) != inputRole
        }
    ) {
        return null
    }
    return OwnerConventionStaticApi(
        typeName = "$packageName.${primaryType.name}",
        ownerPackage = ownerPackage,
        publicStaticMethodNames = setOf(method.name)
    )
}

private fun OwnerConventionSupport.canonicalStateApi(
    parsedSource: OwnerConventionParsedJavaSource,
    ownerPackage: String,
    primaryType: OwnerConventionParsedJavaType,
    snapshot: OwnerConventionSnapshot
): OwnerConventionStaticApi? {
    val packageName = parsedSource.packageName ?: return null
    val validKind = primaryType.kind == OwnerConventionParsedJavaTypeKind.RECORD ||
        primaryType.kind == OwnerConventionParsedJavaTypeKind.ENUM ||
        (primaryType.kind == OwnerConventionParsedJavaTypeKind.CLASS && Modifier.FINAL in primaryType.modifiers)
    if (parsedSource.topLevelTypes.size != 1 || !validKind) {
        return null
    }
    if (primaryType.kind == OwnerConventionParsedJavaTypeKind.CLASS && primaryType.constructors.any { Modifier.PUBLIC in it.modifiers }) {
        return null
    }
    val publicMethods = primaryType.methods.filter { Modifier.PUBLIC in it.modifiers }
    if (publicMethods.any { Modifier.STATIC !in it.modifiers }) {
        return null
    }
    val validMethodNames = publicMethods
        .filter { Modifier.STATIC in it.modifiers }
        .filter { method ->
            val parameterPackages = method.parameters.flatMap { parameter ->
                projectTypePackages(parameter.tree.type, parsedSource, snapshot)
            }.distinct()
            val returnPackages = projectTypePackages(method.tree.returnType, parsedSource, snapshot)
            parameterPackages.all { projectPackage ->
                sameOwner(ownerPackage, projectPackage) &&
                    roleForDirectoryName(projectPackage.substringAfterLast('.')) in setOf(inputRole, stateRole)
            } && returnPackages.all { projectPackage ->
                sameOwner(ownerPackage, projectPackage) &&
                    roleForDirectoryName(projectPackage.substringAfterLast('.')) == stateRole
            }
        }
        .map { method -> method.name }
        .toSet()
    return OwnerConventionStaticApi(
        typeName = "$packageName.${primaryType.name}",
        ownerPackage = ownerPackage,
        publicStaticMethodNames = validMethodNames
    )
}

private fun OwnerConventionSupport.canonicalRepositoryApi(
    parsedSource: OwnerConventionParsedJavaSource,
    ownerPackage: String,
    primaryType: OwnerConventionParsedJavaType,
    snapshot: OwnerConventionSnapshot
): OwnerConventionStaticApi? {
    val packageName = parsedSource.packageName ?: return null
    if (
        parsedSource.topLevelTypes.size != 1 ||
        primaryType.kind != OwnerConventionParsedJavaTypeKind.CLASS ||
        Modifier.FINAL !in primaryType.modifiers
    ) {
        return null
    }
    if (
        primaryType.constructors.none { Modifier.PRIVATE in it.modifiers } ||
        primaryType.constructors.any { Modifier.PUBLIC in it.modifiers }
    ) {
        return null
    }
    val publicMethods = primaryType.methods.filter { Modifier.PUBLIC in it.modifiers }
    if (publicMethods.any { Modifier.STATIC !in it.modifiers }) {
        return null
    }
    val validMethodNames = publicMethods
        .filter { Modifier.STATIC in it.modifiers }
        .filter { method ->
            val parameterPackages = method.parameters.flatMap { parameter ->
                projectTypePackages(parameter.tree.type, parsedSource, snapshot)
            }.distinct()
            val returnPackages = projectTypePackages(method.tree.returnType, parsedSource, snapshot)
            parameterPackages.all { projectPackage ->
                sameOwner(ownerPackage, projectPackage) &&
                    roleForDirectoryName(projectPackage.substringAfterLast('.')) == stateRole
            } && returnPackages.all { projectPackage ->
                sameOwner(ownerPackage, projectPackage) &&
                    roleForDirectoryName(projectPackage.substringAfterLast('.')) == stateRole
            }
        }
        .map { method -> method.name }
        .toSet()
    return OwnerConventionStaticApi(
        typeName = "$packageName.${primaryType.name}",
        ownerPackage = ownerPackage,
        publicStaticMethodNames = validMethodNames
    )
}

private fun OwnerConventionSupport.isCanonicalOwnerRequestShape(
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
    val parameterTypes = projectTypeNames(method.parameters.single().tree.type, parsedSource, snapshot)
    if (parameterTypes != setOf(expectedInputType)) {
        return false
    }
    val returnPackages = projectTypePackages(method.tree.returnType, parsedSource, snapshot)
    return returnPackages.all { projectPackage -> roleForDirectoryName(projectPackage.substringAfterLast('.')) == inputRole }
}
