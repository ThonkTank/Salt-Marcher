package saltmarcher.buildlogic.verification

internal fun org.gradle.api.Project.registerQualityConventionHarness(
    environment: QualityConventionEnvironment,
    lifecycleTasks: QualityConventionLifecycleTasks
): VerificationHarnessExtension {
    val verificationLayout = environment.verificationLayout
    val harness = VerificationHarnessExtension(
        project = this,
        enforcementBundles = environment.enforcementBundles,
        sourceSets = verificationLayout.sourceSets,
        mainSourceSet = verificationLayout.mainSourceSet,
        sourceRoots = verificationLayout.sourceRoots,
        sourceJavaRoots = verificationLayout.sourceJavaRoots,
        commonFocusedArchunitSupportIncludes = verificationLayout.commonFocusedArchunitSupportIncludes,
        configureCommonErrorProneOptions = { applyCommonErrorProneOptions(this) },
        productionBuild = lifecycleTasks.productionBuild,
        checkQualityHygiene = lifecycleTasks.checkQualityHygiene,
        checkArchitecture = lifecycleTasks.checkArchitecture,
        ckjmMain = lifecycleTasks.ckjmMain,
        check = lifecycleTasks.check
    )
    extensions.add(VerificationHarnessExtension::class.java, "saltmarcherVerificationHarness", harness)
    return harness
}
