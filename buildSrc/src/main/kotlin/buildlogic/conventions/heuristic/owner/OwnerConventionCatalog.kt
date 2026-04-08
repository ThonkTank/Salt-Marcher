package buildlogic.conventions.heuristic.owner

import javax.lang.model.element.Modifier

internal data class OwnerConventionStaticApi(
    val typeName: String,
    val ownerPackage: String,
    val publicStaticMethodNames: Set<String>
)

internal data class OwnerConventionInputApi(
    val typeName: String,
    val ownerPackage: String
)

internal data class OwnerConventionCatalog(
    val ownerSurfacesByOwner: Map<String, OwnerConventionOwnerSurface>,
    val canonicalOwnerCallersByOwner: Map<String, OwnerConventionCanonicalOwnerCaller>,
    val inputApisByTypeName: Map<String, OwnerConventionInputApi>,
    val taskApisByTypeName: Map<String, OwnerConventionStaticApi>,
    val stateApisByTypeName: Map<String, OwnerConventionStaticApi>,
    val repositoryApisByTypeName: Map<String, OwnerConventionStaticApi>
) {
    companion object {
        val EMPTY = OwnerConventionCatalog(
            ownerSurfacesByOwner = emptyMap(),
            canonicalOwnerCallersByOwner = emptyMap(),
            inputApisByTypeName = emptyMap(),
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
    val allSourceFiles = sourceFiles(snapshot)
    val ownerSurfacesByOwner = allSourceFiles
        .asSequence()
        .filter { sourceFile -> sourceFile.context.role == ownerRole }
        .mapNotNull { sourceFile ->
            analyzeOwnerSurfaceFile(sourceFile, snapshot, this).let { analysis ->
                analysis.model?.ownerPackage?.let { ownerPackage -> ownerPackage to analysis.model }
            }
        }
        .toMap(linkedMapOf())
    val requestStemsByOwner = ownerSurfacesByOwner.mapValues { (_, surface) -> surface.requestStems }
    val surfaceCatalog = OwnerConventionCatalog(
        ownerSurfacesByOwner = ownerSurfacesByOwner,
        canonicalOwnerCallersByOwner = emptyMap(),
        inputApisByTypeName = emptyMap(),
        taskApisByTypeName = emptyMap(),
        stateApisByTypeName = emptyMap(),
        repositoryApisByTypeName = emptyMap()
    )
    val surfaceSnapshot = snapshot.copy(
        requestStemsByOwner = requestStemsByOwner,
        catalog = surfaceCatalog
    )
    val inputApisByTypeName = allSourceFiles
        .asSequence()
        .filter { sourceFile -> sourceFile.context.role == inputRole }
        .mapNotNull { sourceFile -> analyzeInputFile(sourceFile, surfaceSnapshot, this).model }
        .associateBy(OwnerConventionInputApi::typeName)
    val inputCatalog = surfaceCatalog.copy(
        inputApisByTypeName = inputApisByTypeName
    )
    val inputSnapshot = surfaceSnapshot.copy(catalog = inputCatalog)
    val taskApisByTypeName = allSourceFiles
        .asSequence()
        .filter { sourceFile -> sourceFile.context.role == taskRole }
        .mapNotNull { sourceFile -> analyzeTaskFile(sourceFile, inputSnapshot, this).model }
        .associateBy(OwnerConventionStaticApi::typeName)
    val stateApisByTypeName = allSourceFiles
        .asSequence()
        .filter { sourceFile -> sourceFile.context.role == stateRole }
        .mapNotNull { sourceFile -> analyzeStateFile(sourceFile, inputSnapshot, this).model }
        .associateBy(OwnerConventionStaticApi::typeName)
    val repositoryApisByTypeName = allSourceFiles
        .asSequence()
        .filter { sourceFile -> sourceFile.context.role == repositoryRole }
        .mapNotNull { sourceFile -> analyzeRepositoryFile(sourceFile, inputSnapshot, this).model }
        .associateBy(OwnerConventionStaticApi::typeName)
    val coreCatalog = inputCatalog.copy(
        taskApisByTypeName = taskApisByTypeName,
        stateApisByTypeName = stateApisByTypeName,
        repositoryApisByTypeName = repositoryApisByTypeName
    )
    val coreSnapshot = inputSnapshot.copy(catalog = coreCatalog)
    val canonicalOwnerCallersByOwner = allSourceFiles
        .asSequence()
        .filter { sourceFile -> sourceFile.context.role == ownerRole }
        .mapNotNull { sourceFile ->
            analyzeOwnerFile(sourceFile, coreSnapshot, this).model?.let { ownerCaller ->
                ownerCaller.ownerPackage to ownerCaller
            }
        }
        .toMap(linkedMapOf())
    return coreCatalog.copy(
        canonicalOwnerCallersByOwner = canonicalOwnerCallersByOwner
    )
}
internal fun OwnerConventionSupport.analyzeOwnerSurfaceFile(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): OwnerConventionAnalysis<OwnerConventionOwnerSurface> {
    val context = sourceFile.context
    if (context.role != ownerRole || !context.className.endsWith("Object.java")) {
        return OwnerConventionAnalysis(
            reasons = emptyList(),
            model = null
        )
    }
    val primaryType = parsedPrimaryType(sourceFile)
        ?: return OwnerConventionAnalysis(reasons = emptyList(), model = null)
    if (
        sourceFile.parsedSource.topLevelTypes.size != 1 ||
        primaryType.kind != OwnerConventionParsedJavaTypeKind.CLASS ||
        javax.lang.model.element.Modifier.PUBLIC !in primaryType.modifiers ||
        javax.lang.model.element.Modifier.FINAL !in primaryType.modifiers
    ) {
        return OwnerConventionAnalysis(reasons = emptyList(), model = null)
    }
    val requestMethodNames = primaryType.methods
        .filter { method ->
            support.isOwnerSurfaceRequestShape(
                method = method,
                ownerPackage = context.ownerPackage,
                parsedSource = sourceFile.parsedSource,
                snapshot = snapshot
            )
        }
        .map(OwnerConventionParsedJavaMethod::name)
        .toSet()
    return OwnerConventionAnalysis(
        reasons = emptyList(),
        model = OwnerConventionOwnerSurface(
            typeName = "${context.packageName}.${primaryType.name}",
            ownerPackage = context.ownerPackage,
            requestMethodNames = requestMethodNames,
            requestStems = requestMethodNames.mapNotNull(support::requestStemForMethod).toSet()
        )
    )
}

private fun OwnerConventionSupport.isOwnerSurfaceRequestShape(
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
    val parameterType = declaredProjectTypeName(method.parameters.single().tree.type, parsedSource, snapshot)
    if (parameterType != expectedInputType) {
        return false
    }
    val returnPackages = projectTypePackages(method.tree.returnType, parsedSource, snapshot)
    return returnPackages.all { projectPackage -> roleForDirectoryName(projectPackage.substringAfterLast('.')) == inputRole }
}
