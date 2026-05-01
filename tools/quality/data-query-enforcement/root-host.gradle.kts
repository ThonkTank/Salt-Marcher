import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.withGroovyBuilder

val dataQueryRulesetFile = layout.projectDirectory.file(
    "tools/quality/data-query-enforcement/pmd/ruleset.xml"
)

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        listOf(
            "DataQueryGatewayCollaboratorBoundary",
            "DataQueryGatewayMutationBoundary",
            "DataQueryPublicSignatureBoundary",
            "DataQueryRoleContract"
        ).forEach { checkName ->
            "error"(checkName)
        }
    }
}

val pmdDataQueryEnforcement by tasks.registering(Pmd::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run the dedicated Data Query PMD enforcement bundle."
    dependsOn(gradle.includedBuild("quality-rules").task(":jar"))

    ignoreFailures = false
    ruleSets = listOf()
    ruleSetFiles = files(dataQueryRulesetFile)
    source = fileTree("src") {
        include("data/**/query/**/*.java")
    }
    classpath = files()

    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    reports {
        html.required.set(true)
        xml.required.set(true)
    }
}

val checkDataQueryEnforcement by tasks.registering {
    group = "verification"
    description = "Run the dedicated Data Query enforcement bundle through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(pmdDataQueryEnforcement)
    dependsOn(gradle.includedBuild("build-harness").task(":dataQueryEnforcementDocumentationCheck"))
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn(checkDataQueryEnforcement)
}

tasks.named("check") {
    dependsOn(checkDataQueryEnforcement)
}
