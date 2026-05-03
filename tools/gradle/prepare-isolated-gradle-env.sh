saltmarcher_is_nonblank() {
    [ -n "${1:-}" ]
}

saltmarcher_first_nonblank() {
    for candidate in "$@"; do
        if saltmarcher_is_nonblank "$candidate"; then
            printf '%s' "$candidate"
            return 0
        fi
    done
    return 1
}

saltmarcher_sanitized_segment() {
    raw_value=$1
    sanitized_value=$(
        printf '%s' "$raw_value" |
            LC_ALL=C tr -cs 'A-Za-z0-9._-' '-' |
            cut -c1-48 |
            sed 's/^[._-]*//; s/[._-]*$//'
    )
    [ -n "$sanitized_value" ] || sanitized_value=agent
    checksum_value=$(printf '%s' "$raw_value" | cksum | awk '{print $1}')
    printf '%s-%s' "$sanitized_value" "$checksum_value"
}

saltmarcher_copy_tree() {
    source_path=$1
    target_path=$2

    rm -rf "$target_path"
    mkdir -p "$(dirname "$target_path")"
    cp -R "$source_path" "$target_path"
    find "$target_path" \
        \( -name build -o -name .gradle -o -name .kotlin \) \
        -type d -prune -exec rm -rf {} +
}

saltmarcher_seed_wrapper_distribution() {
    seed_gradle_home=$1
    isolated_gradle_home=$2
    wrapper_properties_file=$APP_HOME/gradle/wrapper/gradle-wrapper.properties

    [ -f "$wrapper_properties_file" ] || return 0
    [ "$seed_gradle_home" != "$isolated_gradle_home" ] || return 0

    distribution_url=$(
        sed -n 's/^distributionUrl=//p' "$wrapper_properties_file" |
            sed 's#\\:#:#g'
    )
    [ -n "$distribution_url" ] || return 0

    distribution_name=$(basename "$distribution_url" .zip)
    source_wrapper_dir=$seed_gradle_home/wrapper/dists/$distribution_name
    target_wrapper_dir=$isolated_gradle_home/wrapper/dists/$distribution_name
    temp_wrapper_dir=$target_wrapper_dir.tmp.$$

    [ -d "$source_wrapper_dir" ] || return 0
    [ -d "$target_wrapper_dir" ] && return 0

    rm -rf "$temp_wrapper_dir"
    mkdir -p "$(dirname "$target_wrapper_dir")"
    cp -R "$source_wrapper_dir" "$temp_wrapper_dir"
    find "$temp_wrapper_dir" -name '*.lck' -type f -delete
    rm -rf "$target_wrapper_dir"
    mv "$temp_wrapper_dir" "$target_wrapper_dir"
}

saltmarcher_seed_read_only_dependency_cache() {
    seed_gradle_home=$1
    read_only_dependency_cache_root=$2
    source_modules_dir=$seed_gradle_home/caches/modules-2
    target_modules_dir=$read_only_dependency_cache_root/modules-2
    temp_modules_dir=$target_modules_dir.tmp.$$

    [ -d "$source_modules_dir" ] || return 0
    [ -d "$target_modules_dir" ] && return 0

    rm -rf "$temp_modules_dir"
    mkdir -p "$read_only_dependency_cache_root"
    cp -R "$source_modules_dir" "$temp_modules_dir"
    find "$temp_modules_dir" \( -name '*.lock' -o -name 'gc.properties' \) -type f -delete
    rm -rf "$target_modules_dir"
    mv "$temp_modules_dir" "$target_modules_dir"
}

saltmarcher_seed_generated_gradle_api_jars() {
    seed_gradle_home=$1
    isolated_gradle_home=$2

    for source_generated_dir in "$seed_gradle_home"/caches/*/generated-gradle-jars; do
        [ -d "$source_generated_dir" ] || continue
        relative_generated_dir=${source_generated_dir#"$seed_gradle_home"/}
        target_generated_dir=$isolated_gradle_home/$relative_generated_dir
        temp_generated_dir=$target_generated_dir.tmp.$$

        [ -d "$target_generated_dir" ] && continue

        rm -rf "$temp_generated_dir"
        mkdir -p "$(dirname "$target_generated_dir")"
        cp -R "$source_generated_dir" "$temp_generated_dir"
        find "$temp_generated_dir" \( -name '*.lock' -o -name 'gc.properties' \) -type f -delete
        rm -rf "$target_generated_dir"
        mv "$temp_generated_dir" "$target_generated_dir"
    done
}

saltmarcher_prepare_composite_root() {
    composite_root=$1

    mkdir -p "$composite_root/tools/gradle"
    cp "$APP_HOME/tools/gradle/build-isolation.settings.gradle.kts" \
        "$composite_root/tools/gradle/build-isolation.settings.gradle.kts"
    mkdir -p "$composite_root/tools/quality"
    cp "$APP_HOME/tools/quality/enforcement-bundles.gradle.kts" \
        "$composite_root/tools/quality/enforcement-bundles.gradle.kts"

    saltmarcher_copy_tree \
        "$APP_HOME/tools/gradle/build-logic" \
        "$composite_root/tools/gradle/build-logic"
    saltmarcher_copy_tree \
        "$APP_HOME/tools/gradle/build-harness" \
        "$composite_root/tools/gradle/build-harness"
    for bundle_dir in "$APP_HOME"/tools/quality/*-enforcement "$APP_HOME"/tools/quality/documentation-enforcement; do
        [ -d "$bundle_dir" ] || continue
        saltmarcher_copy_tree \
            "$bundle_dir" \
            "$composite_root/tools/quality/$(basename "$bundle_dir")"
    done
    saltmarcher_copy_tree \
        "$APP_HOME/tools/quality/rules/quality-rules" \
        "$composite_root/tools/quality/rules/quality-rules"
    saltmarcher_copy_tree \
        "$APP_HOME/tools/quality/incubator/quality-rules-errorprone" \
        "$composite_root/tools/quality/incubator/quality-rules-errorprone"
}

saltmarcher_write_run_metadata() {
    run_meta_dir=$1
    run_stage=$2

    mkdir -p "$run_meta_dir"
    {
        printf 'rawIsolationId=%s\n' "$saltmarcher_raw_isolation_id"
        printf 'isolationSegment=%s\n' "$saltmarcher_isolation_segment"
        printf 'stage=%s\n' "$run_stage"
        printf 'createdAt=%s\n' "$(date -Iseconds)"
    } > "$run_meta_dir/run.properties"
}

saltmarcher_actor_id=$(
    saltmarcher_first_nonblank \
        "${SALTMARCHER_GRADLE_STAGE:-}" \
        "${SALTMARCHER_GRADLE_ISOLATION_ID:-}" \
        "${CODEX_THREAD_ID:-}" \
        local
) || saltmarcher_actor_id=local
saltmarcher_stage=$(
    saltmarcher_first_nonblank \
        "${SALTMARCHER_GRADLE_STAGE:-}" \
        default
) || saltmarcher_stage=default
saltmarcher_invocation_timestamp=$(date +%Y%m%dT%H%M%S%N 2>/dev/null || date +%Y%m%dT%H%M%S)
saltmarcher_raw_isolation_id=$(
    saltmarcher_first_nonblank \
        "${SALTMARCHER_GRADLE_INVOCATION_ID:-}" \
        "${saltmarcher_actor_id}-${saltmarcher_invocation_timestamp}-pid$$-ppid${PPID:-0}"
) || saltmarcher_raw_isolation_id="${saltmarcher_actor_id}-${saltmarcher_invocation_timestamp}-pid$$"
saltmarcher_isolation_segment=$(saltmarcher_sanitized_segment "$saltmarcher_raw_isolation_id")
saltmarcher_seed_gradle_home=${GRADLE_USER_HOME:-$HOME/.gradle}
saltmarcher_run_root=$APP_HOME/.gradle/isolated-runs/$saltmarcher_isolation_segment
saltmarcher_run_meta_dir=$saltmarcher_run_root/meta
saltmarcher_isolated_gradle_home=$saltmarcher_run_root/gradle-user-home
saltmarcher_isolated_runtime_root=$saltmarcher_run_root/project-cache
saltmarcher_root_project_cache_dir=$saltmarcher_isolated_runtime_root/root
saltmarcher_isolated_build_root=$saltmarcher_run_root/build
saltmarcher_composite_root=$saltmarcher_run_root/composite-root
saltmarcher_read_only_dependency_cache_root=$APP_HOME/.gradle/read-only-dependency-cache
saltmarcher_latest_output_root=$APP_HOME/build/latest-output
saltmarcher_latest_reports_root=$APP_HOME/build/latest-reports
saltmarcher_retained_failures_root=$APP_HOME/build/retained-gradle-failures

mkdir -p \
    "$saltmarcher_isolated_gradle_home" \
    "$saltmarcher_isolated_runtime_root" \
    "$saltmarcher_isolated_build_root"
saltmarcher_seed_wrapper_distribution "$saltmarcher_seed_gradle_home" "$saltmarcher_isolated_gradle_home"
saltmarcher_seed_generated_gradle_api_jars "$saltmarcher_seed_gradle_home" "$saltmarcher_isolated_gradle_home"
if ! saltmarcher_is_nonblank "${GRADLE_RO_DEP_CACHE:-}"; then
    saltmarcher_seed_read_only_dependency_cache \
        "$saltmarcher_seed_gradle_home" \
        "$saltmarcher_read_only_dependency_cache_root"
fi
saltmarcher_prepare_composite_root "$saltmarcher_composite_root"
saltmarcher_write_run_metadata "$saltmarcher_run_meta_dir" "$saltmarcher_stage"

export GRADLE_USER_HOME=$saltmarcher_isolated_gradle_home
export SALTMARCHER_GRADLE_STAGE=$saltmarcher_stage
export SALTMARCHER_GRADLE_INVOCATION_ID=$saltmarcher_raw_isolation_id
export SALTMARCHER_INCLUDED_BUILD_ROOT=$saltmarcher_composite_root
export SALTMARCHER_GRADLE_ISOLATION_SEGMENT=$saltmarcher_isolation_segment
export SALTMARCHER_GRADLE_RUN_ROOT=$saltmarcher_run_root
export SALTMARCHER_GRADLE_RUN_META_DIR=$saltmarcher_run_meta_dir
export SALTMARCHER_GRADLE_ISOLATED_USER_HOME=$saltmarcher_isolated_gradle_home
export SALTMARCHER_GRADLE_ISOLATED_RUNTIME_ROOT=$saltmarcher_isolated_runtime_root
export SALTMARCHER_GRADLE_ROOT_PROJECT_CACHE_DIR=$saltmarcher_root_project_cache_dir
export SALTMARCHER_GRADLE_ISOLATED_BUILD_ROOT=$saltmarcher_isolated_build_root
export SALTMARCHER_GRADLE_LATEST_OUTPUT_ROOT=$saltmarcher_latest_output_root
export SALTMARCHER_GRADLE_LATEST_REPORTS_ROOT=$saltmarcher_latest_reports_root
export SALTMARCHER_GRADLE_RETAINED_FAILURES_ROOT=$saltmarcher_retained_failures_root
if ! saltmarcher_is_nonblank "${GRADLE_RO_DEP_CACHE:-}" \
    && [ -d "$saltmarcher_read_only_dependency_cache_root/modules-2" ]; then
    export GRADLE_RO_DEP_CACHE=$saltmarcher_read_only_dependency_cache_root
fi
