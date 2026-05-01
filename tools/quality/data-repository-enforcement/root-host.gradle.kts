import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.withGroovyBuilder

private val dataRepositoryRulesetFile = layout.projectDirectory.file(
    "tools/quality/data-repository-enforcement/pmd/ruleset.xml"
)

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        listOf(
            "DataRepositoryRoleContract",
            "DataRepositoryPublicSignatureBoundary",
            "DataRepositoryGatewayCollaboratorBoundary"
        ).forEach { checkName ->
            "error"(checkName)
        }
    }
}

val pmdDataRepositoryEnforcement by tasks.registering(Pmd::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run the dedicated Data Repository PMD enforcement bundle."
    dependsOn(gradle.includedBuild("quality-rules").task(":jar"))

    ignoreFailures = false
    ruleSets = listOf()
    ruleSetFiles = files(dataRepositoryRulesetFile)
    source = fileTree("src") {
        include("data/**/repository/**/*.java")
    }
    classpath = files()

    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    reports {
        html.required.set(true)
        xml.required.set(true)
    }
}

val checkDataRepositoryEnforcement by tasks.registering {
    group = "verification"
    description = "Run the dedicated Data Repository enforcement bundle through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(pmdDataRepositoryEnforcement)
    dependsOn(gradle.includedBuild("build-harness").task(":dataRepositoryEnforcementDocumentationCheck"))
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn(checkDataRepositoryEnforcement)
}

tasks.named("check") {
    dependsOn(checkDataRepositoryEnforcement)
}
