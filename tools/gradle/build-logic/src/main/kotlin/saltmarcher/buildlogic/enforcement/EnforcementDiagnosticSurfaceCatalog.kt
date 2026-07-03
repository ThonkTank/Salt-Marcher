package saltmarcher.buildlogic.enforcement

data class EnforcementDiagnosticSurfaceSpec(
    val surfaceId: String,
    val diagnosticTaskName: String,
    val description: String,
    val bundleIds: List<String>,
    val focusSourceRoots: List<String>,
    val inferredFocusSourceRoots: List<String> = focusSourceRoots,
    val inferFromFocusedPath: Boolean = true
) {
    fun buildHarnessTaskName(kind: BuildHarnessTaskKind): String {
        val suffix = when (kind) {
            BuildHarnessTaskKind.TOPOLOGY -> "TopologyCheck"
            BuildHarnessTaskKind.DOCUMENTATION -> "DocumentationCheck"
        }
        return "${surfaceId.replaceFirstChar(Char::lowercaseChar)}BuildHarness$suffix"
    }
}

data class EnforcementDiagnosticSurfaceCatalog(
    val specsById: Map<String, EnforcementDiagnosticSurfaceSpec>
) {
    val surfacesInOrder: List<EnforcementDiagnosticSurfaceSpec> = specsById.values.toList()

    val diagnosticTaskToBundleIds: Map<String, List<String>> = surfacesInOrder.associate { spec ->
        spec.diagnosticTaskName to spec.bundleIds
    }

    fun surface(surfaceId: String): EnforcementDiagnosticSurfaceSpec = specsById[surfaceId]
        ?: error("Unknown enforcement diagnostic surface '$surfaceId'.")

    fun surfacesForBundle(bundleId: String): List<EnforcementDiagnosticSurfaceSpec> = surfacesInOrder
        .filter { spec -> bundleId in spec.bundleIds }

    fun focusedSurfaceIdsForAreas(areaIds: List<String>): List<String> = areaIds
        .map { areaId -> surface(areaId).surfaceId }
        .distinct()

    fun focusedSurfaceIdsForPaths(paths: List<String>): List<String> = paths
        .flatMap { path -> surfacesInOrder.filter { surface -> surface.matchesFocusedPath(path) } }
        .map(EnforcementDiagnosticSurfaceSpec::surfaceId)
        .distinct()
}

private fun enforcementDiagnosticSurface(
    surfaceId: String,
    diagnosticTaskName: String,
    description: String,
    bundleIds: List<String>,
    focusSourceRoots: List<String>,
    inferredFocusSourceRoots: List<String> = focusSourceRoots,
    inferFromFocusedPath: Boolean = true
): EnforcementDiagnosticSurfaceSpec = EnforcementDiagnosticSurfaceSpec(
    surfaceId = surfaceId,
    diagnosticTaskName = diagnosticTaskName,
    description = description,
    bundleIds = bundleIds,
    focusSourceRoots = focusSourceRoots,
    inferredFocusSourceRoots = inferredFocusSourceRoots,
    inferFromFocusedPath = inferFromFocusedPath
)

private fun EnforcementDiagnosticSurfaceSpec.matchesFocusedPath(path: String): Boolean =
    inferFromFocusedPath && inferredFocusSourceRoots.any { root -> path == root || path.startsWith("$root/") }

fun standardEnforcementDiagnosticSurfaceCatalog(
    bundleCatalog: EnforcementBundleCatalog = standardEnforcementBundleCatalog()
): EnforcementDiagnosticSurfaceCatalog {
    val specs = listOf(
        enforcementDiagnosticSurface(
            surfaceId = "view",
            diagnosticTaskName = "checkViewEnforcement",
            description = "Run the focused View enforcement diagnostic surface.",
            focusSourceRoots = listOf("src/view"),
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
        enforcementDiagnosticSurface(
            surfaceId = "styling",
            diagnosticTaskName = "checkStylingEnforcement",
            description = "Run the focused Styling enforcement diagnostic surface.",
            focusSourceRoots = listOf("resources", "bootstrap", "shell", "src"),
            inferredFocusSourceRoots = listOf("resources", "src/view"),
            bundleIds = listOf("stylingLayer", "stylingView")
        ),
        enforcementDiagnosticSurface(
            surfaceId = "shell",
            diagnosticTaskName = "checkShellEnforcement",
            description = "Run the focused Shell enforcement diagnostic surface.",
            focusSourceRoots = listOf("shell"),
            bundleIds = listOf("shellAppShell", "shellLayer")
        ),
        enforcementDiagnosticSurface(
            surfaceId = "bootstrap",
            diagnosticTaskName = "checkBootstrapEnforcement",
            description = "Run the focused Bootstrap enforcement diagnostic surface.",
            focusSourceRoots = listOf("bootstrap"),
            bundleIds = listOf("bootstrapAppBootstrap", "bootstrapLayer")
        ),
        enforcementDiagnosticSurface(
            surfaceId = "layering",
            diagnosticTaskName = "checkLayeringEnforcement",
            description = "Run the focused Layering enforcement diagnostic surface.",
            focusSourceRoots = listOf("bootstrap", "shell", "src", "tools/quality/layering-architecture-enforcement"),
            inferFromFocusedPath = false,
            bundleIds = listOf("layeringArchitecture")
        ),
        enforcementDiagnosticSurface(
            surfaceId = "feature-runtime",
            diagnosticTaskName = "checkFeatureRuntimeEnforcement",
            description = "Run the focused Feature Runtime placement enforcement diagnostic surface.",
            focusSourceRoots = listOf("src/features"),
            bundleIds = listOf("layeringArchitecture")
        ),
        enforcementDiagnosticSurface(
            surfaceId = "domain",
            diagnosticTaskName = "checkDomainEnforcement",
            description = "Run the focused Domain enforcement diagnostic surface.",
            focusSourceRoots = listOf("src/domain"),
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
        enforcementDiagnosticSurface(
            surfaceId = "data",
            diagnosticTaskName = "checkDataEnforcement",
            description = "Run the focused Data enforcement diagnostic surface.",
            focusSourceRoots = listOf("src/data"),
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
            "Enforcement diagnostic surface '${spec.surfaceId}' must declare at least one bundle."
        }
        require(spec.focusSourceRoots.isNotEmpty()) {
            "Enforcement diagnostic surface '${spec.surfaceId}' must declare at least one focused source root."
        }
        require(spec.inferredFocusSourceRoots.all { inferredRoot ->
            spec.focusSourceRoots.any { root -> inferredRoot == root || inferredRoot.startsWith("$root/") }
        }) {
            "Enforcement diagnostic surface '${spec.surfaceId}' inferred focused source roots must be a subset of focused source roots."
        }
        val unknownBundleIds = spec.bundleIds.filterNot(bundleIds::contains)
        require(unknownBundleIds.isEmpty()) {
            "Enforcement diagnostic surface '${spec.surfaceId}' references unknown bundle ids: ${unknownBundleIds.joinToString()}."
        }
    }

    return EnforcementDiagnosticSurfaceCatalog(
        specs.associateBy(EnforcementDiagnosticSurfaceSpec::surfaceId)
    )
}
