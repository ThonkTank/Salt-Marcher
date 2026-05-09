package saltmarcher.buildlogic.enforcement

data class VerificationSurfaceSpec(
    val surfaceId: String,
    val publicTaskName: String,
    val description: String,
    val bundleIds: List<String>
)

data class VerificationSurfaceCatalog(
    val specsById: Map<String, VerificationSurfaceSpec>
) {
    val surfacesInOrder: List<VerificationSurfaceSpec> = specsById.values.toList()

    val taskToBundleIds: Map<String, List<String>> = surfacesInOrder.associate { spec ->
        spec.publicTaskName to spec.bundleIds
    }

    fun surface(surfaceId: String): VerificationSurfaceSpec = specsById[surfaceId]
        ?: error("Unknown verification surface '$surfaceId'.")
}

private fun verificationSurface(
    surfaceId: String,
    publicTaskName: String,
    description: String,
    bundleIds: List<String>
): VerificationSurfaceSpec = VerificationSurfaceSpec(
    surfaceId = surfaceId,
    publicTaskName = publicTaskName,
    description = description,
    bundleIds = bundleIds
)

fun standardVerificationSurfaceCatalog(
    bundleCatalog: EnforcementBundleCatalog = standardEnforcementBundleCatalog()
): VerificationSurfaceCatalog {
    val specs = listOf(
        verificationSurface(
            surfaceId = "view",
            publicTaskName = "checkViewEnforcement",
            description = "Run the canonical View enforcement surface.",
            bundleIds = listOf(
                "viewLayer",
                "view",
                "viewInputEvent",
                "viewContribution",
                "viewBinder",
                "viewContributionModel",
                "viewContentModel",
                "viewIntentHandler"
            )
        ),
        verificationSurface(
            surfaceId = "styling",
            publicTaskName = "checkStylingEnforcement",
            description = "Run the canonical Styling enforcement surface.",
            bundleIds = listOf("stylingLayer", "stylingView")
        ),
        verificationSurface(
            surfaceId = "shell",
            publicTaskName = "checkShellEnforcement",
            description = "Run the canonical Shell enforcement surface.",
            bundleIds = listOf("shellAppShell", "shellLayer")
        ),
        verificationSurface(
            surfaceId = "bootstrap",
            publicTaskName = "checkBootstrapEnforcement",
            description = "Run the canonical Bootstrap enforcement surface.",
            bundleIds = listOf("bootstrapAppBootstrap", "bootstrapLayer")
        ),
        verificationSurface(
            surfaceId = "layering",
            publicTaskName = "checkLayeringEnforcement",
            description = "Run the canonical Layering enforcement surface.",
            bundleIds = listOf("layeringArchitecture")
        ),
        verificationSurface(
            surfaceId = "domain",
            publicTaskName = "checkDomainEnforcement",
            description = "Run the canonical Domain enforcement surface.",
            bundleIds = listOf(
                "domainContext",
                "domainLayer",
                "domainUseCase",
                "domainApplicationService",
                "domainPublished",
                "domainPort",
                "domainModel",
                "domainHelper",
                "domainConstants",
                "domainRepository"
            )
        ),
        verificationSurface(
            surfaceId = "data",
            publicTaskName = "checkDataEnforcement",
            description = "Run the canonical Data enforcement surface.",
            bundleIds = listOf(
                "dataLayer",
                "dataModel",
                "dataGateway",
                "dataMapper",
                "dataPersistencecore",
                "dataQuery",
                "dataRepository",
                "dataServiceContribution"
            )
        )
    )

    val bundleIds = bundleCatalog.descriptorsById.keys
    specs.forEach { spec ->
        require(spec.bundleIds.isNotEmpty()) {
            "Verification surface '${spec.surfaceId}' must declare at least one bundle."
        }
        val unknownBundleIds = spec.bundleIds.filterNot(bundleIds::contains)
        require(unknownBundleIds.isEmpty()) {
            "Verification surface '${spec.surfaceId}' references unknown bundle ids: ${unknownBundleIds.joinToString()}."
        }
    }

    return VerificationSurfaceCatalog(
        specs.associateBy(VerificationSurfaceSpec::surfaceId)
    )
}
