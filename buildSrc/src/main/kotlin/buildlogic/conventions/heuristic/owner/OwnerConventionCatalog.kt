package buildlogic.conventions.heuristic.owner

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
        .mapNotNull { sourceFile -> ownerSurfaceShape(sourceFile, snapshot)?.let { surface -> surface.ownerPackage to surface } }
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
        .mapNotNull { sourceFile -> inputApiShape(sourceFile, surfaceSnapshot) }
        .associateBy(OwnerConventionInputApi::typeName)
    val inputCatalog = surfaceCatalog.copy(
        inputApisByTypeName = inputApisByTypeName
    )
    val inputSnapshot = surfaceSnapshot.copy(catalog = inputCatalog)
    val taskApisByTypeName = allSourceFiles
        .asSequence()
        .filter { sourceFile -> sourceFile.context.role == taskRole }
        .mapNotNull { sourceFile -> taskApiShape(sourceFile, inputSnapshot) }
        .associateBy(OwnerConventionStaticApi::typeName)
    val stateApisByTypeName = allSourceFiles
        .asSequence()
        .filter { sourceFile -> sourceFile.context.role == stateRole }
        .mapNotNull { sourceFile -> stateApiShape(sourceFile, inputSnapshot) }
        .associateBy(OwnerConventionStaticApi::typeName)
    val repositoryApisByTypeName = allSourceFiles
        .asSequence()
        .filter { sourceFile -> sourceFile.context.role == repositoryRole }
        .mapNotNull { sourceFile -> repositoryApiShape(sourceFile, inputSnapshot) }
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
        .mapNotNull { sourceFile -> ownerCallerShape(sourceFile, coreSnapshot)?.let { ownerCaller -> ownerCaller.ownerPackage to ownerCaller } }
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
    return OwnerConventionAnalysis(
        reasons = emptyList(),
        model = support.ownerSurfaceShape(sourceFile, snapshot)
    )
}
