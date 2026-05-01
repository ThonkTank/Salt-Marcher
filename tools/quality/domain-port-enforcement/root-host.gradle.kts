import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.withGroovyBuilder

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        listOf(
            "DomainPortRoleShape",
            "DomainPortBoundary"
        ).forEach { checkName ->
            "error"(checkName)
        }
    }
}

val checkDomainPortEnforcement by tasks.registering {
    group = "verification"
    description = "Run the focused Domain Port enforcement bundle through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(gradle.includedBuild("build-harness").task(":domainPortEnforcementDocumentationCheck"))
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn(checkDomainPortEnforcement)
}

tasks.named("check") {
    dependsOn(checkDomainPortEnforcement)
}
