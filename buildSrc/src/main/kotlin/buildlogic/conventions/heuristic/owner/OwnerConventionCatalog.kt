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
        val typeImports = typeImportsFor(parsedSource.importDeclarations, knownPackages)
        val ownerPackage = ownerPackageFor(packageName, role)
        val requestMethods = primaryType.methods
            .filter { method ->
                isCanonicalOwnerRequestShape(
                    method = method,
                    packageName = packageName,
                    ownerPackage = ownerPackage,
                    typeImports = typeImports,
                    knownTypeNames = knownTypeNames
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
        ) { parsedSource, packageName, ownerPackage, primaryType, typeImports ->
            canonicalTaskApi(
                parsedSource = parsedSource,
                packageName = packageName,
                ownerPackage = ownerPackage,
                primaryType = primaryType,
                typeImports = typeImports,
                knownTypeNames = knownTypeNames,
                requestStemsByOwner = requestStemsByOwner
            )
        },
        stateApisByTypeName = buildStaticApisByTypeName(
            parsedSourcesByPath = parsedSourcesByPath,
            knownPackages = knownPackages,
            knownTypeNames = knownTypeNames,
            role = stateRole
        ) { parsedSource, packageName, ownerPackage, primaryType, typeImports ->
            canonicalStateApi(
                parsedSource = parsedSource,
                packageName = packageName,
                ownerPackage = ownerPackage,
                primaryType = primaryType,
                typeImports = typeImports,
                knownTypeNames = knownTypeNames
            )
        },
        repositoryApisByTypeName = buildStaticApisByTypeName(
            parsedSourcesByPath = parsedSourcesByPath,
            knownPackages = knownPackages,
            knownTypeNames = knownTypeNames,
            role = repositoryRole
        ) { parsedSource, packageName, ownerPackage, primaryType, typeImports ->
            canonicalRepositoryApi(
                parsedSource = parsedSource,
                packageName = packageName,
                ownerPackage = ownerPackage,
                primaryType = primaryType,
                typeImports = typeImports,
                knownTypeNames = knownTypeNames
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
    packageName: String,
    ownerPackage: String,
    primaryType: OwnerConventionParsedJavaType,
    typeImports: OwnerConventionTypeImports,
    knownTypeNames: Set<String>,
    requestStemsByOwner: Map<String, Set<String>>
): OwnerConventionStaticApi? {
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
        projectTypeNames(parameter.typeRef, packageName, typeImports, knownTypeNames)
    }.distinct()
    val returnPackages = projectTypePackages(method.returnTypeRef ?: "void", packageName, typeImports, knownTypeNames)
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
    packageName: String,
    ownerPackage: String,
    primaryType: OwnerConventionParsedJavaType,
    typeImports: OwnerConventionTypeImports,
    knownTypeNames: Set<String>
): OwnerConventionStaticApi? {
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
                projectTypePackages(parameter.typeRef, packageName, typeImports, knownTypeNames)
            }.distinct()
            val returnPackages = projectTypePackages(method.returnTypeRef ?: "void", packageName, typeImports, knownTypeNames)
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
    packageName: String,
    ownerPackage: String,
    primaryType: OwnerConventionParsedJavaType,
    typeImports: OwnerConventionTypeImports,
    knownTypeNames: Set<String>
): OwnerConventionStaticApi? {
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
                projectTypePackages(parameter.typeRef, packageName, typeImports, knownTypeNames)
            }.distinct()
            val returnPackages = projectTypePackages(method.returnTypeRef ?: "void", packageName, typeImports, knownTypeNames)
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
    packageName: String,
    ownerPackage: String,
    typeImports: OwnerConventionTypeImports,
    knownTypeNames: Set<String>
): Boolean {
    val requestStem = requestStemForMethod(method.name) ?: return false
    if (Modifier.PUBLIC !in method.modifiers || Modifier.STATIC in method.modifiers) {
        return false
    }
    if (method.parameters.size != 1) {
        return false
    }
    val expectedInputType = "$ownerPackage.$inputRole.${requestStem}Input"
    val parameterTypes = projectTypeNames(method.parameters.single().typeRef, packageName, typeImports, knownTypeNames)
    if (parameterTypes != setOf(expectedInputType)) {
        return false
    }
    val returnPackages = projectTypePackages(method.returnTypeRef ?: "void", packageName, typeImports, knownTypeNames)
    return returnPackages.all { projectPackage -> roleForDirectoryName(projectPackage.substringAfterLast('.')) == inputRole }
}
