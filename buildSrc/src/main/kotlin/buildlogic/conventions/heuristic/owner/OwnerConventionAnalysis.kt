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

internal data class OwnerConventionCanonicalOwnerCaller(
    val typeName: String,
    val ownerPackage: String,
    val requestMethodNames: Set<String>
)

internal fun OwnerConventionOwnerSurface.toCanonicalOwnerCaller(): OwnerConventionCanonicalOwnerCaller {
    return OwnerConventionCanonicalOwnerCaller(
        typeName = typeName,
        ownerPackage = ownerPackage,
        requestMethodNames = requestMethodNames
    )
}

internal inline fun <T> OwnerConventionSupport.extendShapeAnalysis(
    sourceFile: OwnerConventionSourceFile,
    shapeAnalysis: OwnerConventionAnalysis<T>,
    extraReasons: (OwnerConventionParsedJavaType) -> List<String>
): OwnerConventionAnalysis<T> {
    val reasons = shapeAnalysis.reasons.toMutableList()
    val primaryType = parsedPrimaryType(sourceFile)
        ?: return OwnerConventionAnalysis(reasons = reasons.distinct(), model = shapeAnalysis.model)
    reasons += extraReasons(primaryType)
    return OwnerConventionAnalysis(
        reasons = reasons.distinct(),
        model = shapeAnalysis.model
    )
}
