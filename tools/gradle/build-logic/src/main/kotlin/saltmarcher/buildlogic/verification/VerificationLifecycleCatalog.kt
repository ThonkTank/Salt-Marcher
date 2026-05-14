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
    COMPILE_INTEGRITY,
    STRUCTURE,
    HYGIENE
}

internal fun standardVerificationLifecycleCatalog(): VerificationLifecycleCatalog {
    val compileIntegrityOwners = listOf(
        verificationLifecycleOwner("compile-java", "compileJava", VerificationLifecyclePhase.COMPILE_INTEGRITY),
        verificationLifecycleOwner("compile-test-java", "compileTestJava", VerificationLifecyclePhase.COMPILE_INTEGRITY)
    )
    val structureOwners = listOf(
        verificationLifecycleOwner("architecture-test", "architectureTest", VerificationLifecyclePhase.STRUCTURE)
    )
    val hygieneOwners = listOf(
        verificationLifecycleOwner("assemble", "assemble", VerificationLifecyclePhase.HYGIENE),
        verificationLifecycleOwner("pmd-main", "pmdMain", VerificationLifecyclePhase.HYGIENE),
        verificationLifecycleOwner("near-miss-hygiene", "checkRewriteNearMisses", VerificationLifecyclePhase.HYGIENE),
        verificationLifecycleOwner("spotbugs-main", "spotbugsMain", VerificationLifecyclePhase.HYGIENE),
        verificationLifecycleOwner("cpd-main", "cpdMain", VerificationLifecyclePhase.HYGIENE),
        verificationLifecycleOwner("lizard-main", "lizardMain", VerificationLifecyclePhase.HYGIENE),
        verificationLifecycleOwner(
            "compiled-artifact-hygiene",
            "checkNoCompiledArtifactsInSource",
            VerificationLifecyclePhase.HYGIENE
        ),
        verificationLifecycleOwner("dead-code", "checkNoDeadCode", VerificationLifecyclePhase.HYGIENE),
        verificationLifecycleOwner("ckjm-main", "ckjmMain", VerificationLifecyclePhase.HYGIENE)
    )
    val owners = compileIntegrityOwners + structureOwners + hygieneOwners
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
