package saltmarcher.buildlogic.verification

internal data class VerificationLifecycleOwnerSpec(
    val ownerId: String,
    val taskName: String,
    val phase: VerificationLifecyclePhase
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

    fun ownerTaskNames(phase: VerificationLifecyclePhase): List<String> = ownersInOrder
        .filter { owner -> owner.phase == phase }
        .map(VerificationLifecycleOwnerSpec::taskName)
}

internal enum class VerificationLifecyclePhase {
    INTEGRITY,
    QUALITY
}

internal fun standardVerificationLifecycleCatalog(): VerificationLifecycleCatalog {
    val integrityOwners = listOf(
        verificationLifecycleOwner("classes", "classes", VerificationLifecyclePhase.INTEGRITY),
        verificationLifecycleOwner("compile-test-java", "compileTestJava", VerificationLifecyclePhase.INTEGRITY)
    )
    val qualityOwners = listOf(
        verificationLifecycleOwner("assemble", "assemble", VerificationLifecyclePhase.QUALITY),
        verificationLifecycleOwner("pmd-main", "pmdMain", VerificationLifecyclePhase.QUALITY),
        verificationLifecycleOwner("near-miss-hygiene", "checkRewriteNearMisses", VerificationLifecyclePhase.QUALITY),
        verificationLifecycleOwner("spotbugs-main", "spotbugsMain", VerificationLifecyclePhase.QUALITY),
        verificationLifecycleOwner("cpd-main", "cpdMain", VerificationLifecyclePhase.QUALITY),
        verificationLifecycleOwner("lizard-main", "lizardMain", VerificationLifecyclePhase.QUALITY),
        verificationLifecycleOwner(
            "compiled-artifact-hygiene",
            "checkNoCompiledArtifactsInSource",
            VerificationLifecyclePhase.QUALITY
        ),
        verificationLifecycleOwner("dead-code", "checkNoDeadCode", VerificationLifecyclePhase.QUALITY),
        verificationLifecycleOwner("ckjm-main", "ckjmMain", VerificationLifecyclePhase.QUALITY)
    )
    val owners = integrityOwners + qualityOwners
    val dependencyTaskNames = owners.map(VerificationLifecycleOwnerSpec::taskName)
    val checkSurface = verificationLifecycleSurface(
        surfaceId = "check",
        publicTaskName = "check",
        description = "Run the central local build-health aggregate.",
        dependencyTaskNames = listOf("production-handoff")
    )
    val productionHandoffSurface = verificationLifecycleSurface(
        surfaceId = "production-handoff",
        publicTaskName = "production-handoff",
        description = "Run the public production-code handoff surface through the verification core and internal quality owners.",
        dependencyTaskNames = dependencyTaskNames
    )

    return VerificationLifecycleCatalog(
        ownersInOrder = owners,
        surfacesById = listOf(checkSurface, productionHandoffSurface)
            .associateBy(VerificationLifecycleSurfaceSpec::surfaceId)
    )
}

private fun verificationLifecycleOwner(
    ownerId: String,
    taskName: String,
    phase: VerificationLifecyclePhase
): VerificationLifecycleOwnerSpec = VerificationLifecycleOwnerSpec(
    ownerId = ownerId,
    taskName = taskName,
    phase = phase
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
