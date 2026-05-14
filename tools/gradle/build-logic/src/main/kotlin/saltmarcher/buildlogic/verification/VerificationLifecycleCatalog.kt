package saltmarcher.buildlogic.verification

internal data class VerificationLifecycleOwnerSpec(
    val ownerId: String,
    val taskName: String
)

internal data class VerificationLifecycleSurfaceSpec(
    val surfaceId: String,
    val publicTaskName: String,
    val description: String,
    val dependencyTaskNames: List<String>
)

internal data class VerificationLifecycleCatalog(
    val ownersInOrder: List<VerificationLifecycleOwnerSpec>,
    val surfacesById: Map<String, VerificationLifecycleSurfaceSpec>
) {
    fun surface(surfaceId: String): VerificationLifecycleSurfaceSpec = surfacesById[surfaceId]
        ?: error("Unknown verification lifecycle surface '$surfaceId'.")
}

internal fun standardVerificationLifecycleCatalog(): VerificationLifecycleCatalog {
    val sharedHygieneOwners = listOf(
        verificationLifecycleOwner("assemble", "assemble"),
        verificationLifecycleOwner("architecture", "checkArchitecture"),
        verificationLifecycleOwner("pmd-main", "pmdMain"),
        verificationLifecycleOwner("openrewrite-near-miss", "checkRewriteNearMisses"),
        verificationLifecycleOwner("spotbugs-main", "spotbugsMain"),
        verificationLifecycleOwner("cpd-main", "cpdMain"),
        verificationLifecycleOwner("lizard-main", "lizardMain"),
        verificationLifecycleOwner("compiled-artifact-hygiene", "checkNoCompiledArtifactsInSource"),
        verificationLifecycleOwner("dead-code", "checkNoDeadCode"),
        verificationLifecycleOwner("ckjm-main", "ckjmMain")
    )
    val dependencyTaskNames = sharedHygieneOwners.map(VerificationLifecycleOwnerSpec::taskName)
    val checkSurface = verificationLifecycleSurface(
        surfaceId = "check",
        publicTaskName = "check",
        description = "Run the central local build-health aggregate.",
        dependencyTaskNames = dependencyTaskNames
    )
    val productionHandoffSurface = verificationLifecycleSurface(
        surfaceId = "production-handoff",
        publicTaskName = "production-handoff",
        description = "Run the public production handoff surface through the small verification API and internal quality owners.",
        dependencyTaskNames = dependencyTaskNames
    )

    return VerificationLifecycleCatalog(
        ownersInOrder = sharedHygieneOwners,
        surfacesById = listOf(checkSurface, productionHandoffSurface)
            .associateBy(VerificationLifecycleSurfaceSpec::surfaceId)
    )
}

private fun verificationLifecycleOwner(
    ownerId: String,
    taskName: String
): VerificationLifecycleOwnerSpec = VerificationLifecycleOwnerSpec(
    ownerId = ownerId,
    taskName = taskName
)

private fun verificationLifecycleSurface(
    surfaceId: String,
    publicTaskName: String,
    description: String,
    dependencyTaskNames: List<String>
): VerificationLifecycleSurfaceSpec = VerificationLifecycleSurfaceSpec(
    surfaceId = surfaceId,
    publicTaskName = publicTaskName,
    description = description,
    dependencyTaskNames = dependencyTaskNames
)
