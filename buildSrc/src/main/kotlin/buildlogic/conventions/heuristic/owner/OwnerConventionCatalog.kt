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
    val inputApisByTypeName: Map<String, OwnerConventionInputApi>,
    val taskApisByTypeName: Map<String, OwnerConventionStaticApi>,
    val stateApisByTypeName: Map<String, OwnerConventionStaticApi>,
    val repositoryApisByTypeName: Map<String, OwnerConventionStaticApi>
) {
    companion object {
        val EMPTY = OwnerConventionCatalog(
            ownerSurfacesByOwner = emptyMap(),
            inputApisByTypeName = emptyMap(),
            taskApisByTypeName = emptyMap(),
            stateApisByTypeName = emptyMap(),
            repositoryApisByTypeName = emptyMap()
        )
    }
}

internal fun OwnerConventionSupport.buildOwnerConventionCatalog(
    snapshot: OwnerConventionSnapshot
): OwnerConventionCatalog {
    val allSourceFiles = sourceFiles(snapshot)
    val ownerSurfacesByOwner = allSourceFiles
        .asSequence()
        .filter { sourceFile -> sourceFile.context.role == ownerRole }
        .mapNotNull { sourceFile ->
            analyzeOwnerSurfaceShape(sourceFile, snapshot).model?.let { surface -> surface.ownerPackage to surface }
        }
        .toMap(linkedMapOf())
    val requestStemsByOwner = ownerSurfacesByOwner.mapValues { (_, surface) -> surface.requestStems }
    val surfaceCatalog = OwnerConventionCatalog(
        ownerSurfacesByOwner = ownerSurfacesByOwner,
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
        .mapNotNull { sourceFile -> analyzeInputShape(sourceFile, surfaceSnapshot).model }
        .associateBy(OwnerConventionInputApi::typeName)
    val inputCatalog = surfaceCatalog.copy(
        inputApisByTypeName = inputApisByTypeName
    )
    val inputSnapshot = surfaceSnapshot.copy(catalog = inputCatalog)
    val taskApisByTypeName = allSourceFiles
        .asSequence()
        .filter { sourceFile -> sourceFile.context.role == taskRole }
        .mapNotNull { sourceFile -> analyzeTaskShape(sourceFile, inputSnapshot).model }
        .associateBy(OwnerConventionStaticApi::typeName)
    val stateApisByTypeName = allSourceFiles
        .asSequence()
        .filter { sourceFile -> sourceFile.context.role == stateRole }
        .mapNotNull { sourceFile -> analyzeStateShape(sourceFile, inputSnapshot).model }
        .associateBy(OwnerConventionStaticApi::typeName)
    val repositoryApisByTypeName = allSourceFiles
        .asSequence()
        .filter { sourceFile -> sourceFile.context.role == repositoryRole }
        .mapNotNull { sourceFile -> analyzeRepositoryShape(sourceFile, inputSnapshot).model }
        .associateBy(OwnerConventionStaticApi::typeName)
    val coreCatalog = inputCatalog.copy(
        taskApisByTypeName = taskApisByTypeName,
        stateApisByTypeName = stateApisByTypeName,
        repositoryApisByTypeName = repositoryApisByTypeName
    )
    return coreCatalog
}
