import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.withGroovyBuilder

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        "error"("DomainSpecificationRoleShape")
    }
}

val checkDomainSpecificationEnforcement by tasks.registering {
    group = "verification"
    description = "Run the dedicated domain specification role-shape bundle through one root entrypoint."
    dependsOn("compileJava")
}
