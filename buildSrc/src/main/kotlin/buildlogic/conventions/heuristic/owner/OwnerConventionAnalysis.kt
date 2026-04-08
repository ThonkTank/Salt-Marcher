package buildlogic.conventions.heuristic.owner

internal data class OwnerConventionAnalysis<T>(
    val reasons: List<String>,
    val model: T?
)

internal data class OwnerConventionOwnerSurface(
    val typeName: String,
    val ownerPackage: String,
    val requestMethodNames: Set<String>,
    val requestStems: Set<String>
)
