//! Document state owner and the only mutating request dispatcher.
//! SQL, history and file boundaries are private child modules.
use crate::atlas::change::Computed;
use crate::atlas::errors::{invalid, AppError, ErrorCategory};
use crate::atlas::model::{
    ChangeHints, EditArgs, False, InvalidPreviewWire, PlanDiagnostics, PreviewWire, Status, True,
    ValidPreviewWire, Version,
};
use crate::atlas::plans::safe_proposed;
use crate::atlas::{operations, Result};
pub(in crate::atlas) mod commands;
use commands::Request;
pub(in crate::atlas) mod map_tiles;
use rusqlite::Connection;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
pub struct AtlasApplication {
    db: Connection,
    _temp: tempfile::TempDir,
    session: String,
    revision: i64,
    path: Option<PathBuf>,
    cursor: i64,
    tip: i64,
    history_floor: i64,
    state: u64,
    saved: u64,
    next_state: u64,
    last_changes: Option<ChangeHints>,
}
impl AtlasApplication {
    pub fn status(&self) -> Status {
        Status {
            session_id: self.session.clone(),
            revision: self.revision,
            path: self.path.as_ref().map(|p| p.to_string_lossy().into_owned()),
            dirty: self.state != self.saved,
            can_undo: self.cursor > self.history_floor,
            can_redo: self.cursor < self.tip,
            changes: self.last_changes.clone(),
        }
    }
    pub fn path(&self) -> Option<&Path> {
        self.path.as_deref()
    }
    fn check(&self, v: &Version) -> Result<()> {
        if v.session_id != self.session || v.revision != self.revision {
            Err(AppError::stale(
                "Die Vorschau ist veraltet. Bitte erneut prüfen.",
            ))
        } else {
            Ok(())
        }
    }
    pub(in crate::atlas) fn next_action_state(&self) -> u64 {
        self.next_state
    }
    pub fn request(&mut self, cmd: &str, args: Value) -> Result<Value> {
        let request: Request =
            serde_json::from_value(json!({"cmd": cmd, "args": args})).map_err(invalid)?;
        request.dispatch(self)
    }
    fn compute_edit(
        &self,
        input: &EditArgs,
        diagnostics: &mut PlanDiagnostics,
    ) -> Result<Computed> {
        self.check(&input.version)?;
        operations::compute(self, &input.intent, diagnostics)
            .map_err(|e| e.with_context(input.intent.object_ids()))
    }
    fn success_response(
        &self,
        version: Version,
        computed: Computed,
        parts: operations::PreviewParts,
    ) -> ValidPreviewWire {
        ValidPreviewWire {
            terrain: computed.terrain_preview.map(Box::new),
            valid: True,
            version,
            status: Box::new(self.status()),
            objects: parts.objects,
            removed: parts.removed,
            deleted_ids: parts.deleted_ids,
            cascade_counts: parts.cascade_counts,
            generation: computed.generation,
            removed_connections: parts.removed_connections,
            changed: !computed.change.is_empty(),
        }
    }
    fn preview(&self, input: EditArgs) -> Result<PreviewWire> {
        let mut diagnostics = PlanDiagnostics::default();
        match self.compute_edit(&input, &mut diagnostics) {
            Ok(computed) => {
                let parts = operations::preview_parts(&computed);
                Ok(PreviewWire::Valid(self.success_response(
                    input.version,
                    computed,
                    parts,
                )))
            }
            Err(e) if e.category == ErrorCategory::InvalidInput => {
                Ok(PreviewWire::Invalid(InvalidPreviewWire {
                    valid: False,
                    version: input.version,
                    reason: e.message,
                    proposed_objects: diagnostics
                        .proposed
                        .into_iter()
                        .filter(safe_proposed)
                        .collect(),
                    issues: [*e.issue.expect("V7 invalid input carries a typed issue")],
                    objects: [],
                    removed: [],
                    generation: diagnostics.generation,
                    changed: False,
                }))
            }
            Err(e) => Err(e),
        }
    }
    fn commit(&mut self, input: EditArgs) -> Result<ValidPreviewWire> {
        let computed = self.compute_edit(&input, &mut PlanDiagnostics::default())?;
        let parts = operations::preview_parts(&computed);
        self.apply_computed(&computed)?;
        Ok(self.success_response(input.version, computed, parts))
    }
}

mod persistence;
mod storage;
mod terrain_store;

#[cfg(test)]
mod parcel_collision_tests;

#[cfg(test)]
mod parcel_plan_tests;

#[cfg(test)]
mod storage_tests;

#[cfg(test)]
mod error_contract_tests;

#[cfg(test)]
mod plan_context_tests;

#[cfg(test)]
mod input_contract_tests;

#[cfg(test)]
mod interior_application_tests;

#[cfg(test)]
mod identity_contract_tests;

#[cfg(test)]
mod change_hints_tests;

#[cfg(test)]
mod fast_path_tests;

#[cfg(test)]
mod application_test_support;

#[cfg(test)]
mod map_tiles_tests;

#[cfg(test)]
mod road_roughness_tests;

#[cfg(test)]
mod terrain_tests;

#[cfg(test)]
mod scenery_tests;
