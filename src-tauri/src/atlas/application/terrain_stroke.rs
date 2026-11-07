//! Incremental, confirmed height writes. One history action with ordered section deltas per live stroke.
use super::AtlasApplication;
use crate::atlas::{
    errors::ensure,
    model::*,
    terrain::{Brush, TerrainArgs},
    Result,
};
use serde::{Deserialize, Serialize};

#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TerrainAcknowledgement {
    pub status: Status,
    pub surface: Option<crate::atlas::terrain::TerrainResponse>,
}
#[derive(Clone)]
pub(super) struct ActiveStroke {
    id: String,
    brush: Brush,
    last: Point,
    remaining: f64,
    sequence: u32,
    count: usize,
    pub history_started: bool,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BeginTerrainStroke {
    pub version: Version,
    pub stroke_id: String,
    pub brush: Brush,
    pub view: Option<TerrainArgs>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AppendTerrainStroke {
    pub session_id: String,
    pub stroke_id: String,
    pub sequence: u32,
    pub points: Vec<Point>,
    pub view: Option<TerrainArgs>,
}
#[cfg_attr(test, derive(ts_rs::TS))]
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EndTerrainStroke {
    pub session_id: String,
    pub stroke_id: String,
}
impl AtlasApplication {
    pub(super) fn begin_terrain_stroke(
        &mut self,
        input: BeginTerrainStroke,
    ) -> Result<TerrainAcknowledgement> {
        self.check(&input.version)?;
        ensure(
            !input.stroke_id.is_empty() && input.stroke_id.len() <= 128,
            "Ungültige Strichidentität",
        )?;
        ensure(
            input.brush.points.len() == 1,
            "Strichbeginn benötigt einen Punkt",
        )?;
        self.terrain_stroke = None;
        let brush = input.brush;
        let state = ActiveStroke {
            id: input.stroke_id,
            last: brush.points[0],
            remaining: spacing(&brush),
            brush: brush.clone(),
            sequence: 0,
            count: 1,
            history_started: false,
        };
        self.terrain_stroke = Some(state);
        let result = self.apply_terrain_section(brush, input.view, None);
        if result.is_err() {
            self.terrain_stroke = None;
        }
        result
    }
    pub(super) fn append_terrain_stroke(
        &mut self,
        input: AppendTerrainStroke,
    ) -> Result<TerrainAcknowledgement> {
        ensure(input.session_id == self.session, "Veraltete Strichsitzung")?;
        let state = self
            .terrain_stroke
            .clone()
            .ok_or_else(|| crate::atlas::errors::invalid("Strich bereits beendet"))?;
        ensure(state.id == input.stroke_id, "Veralteter Strich")?;
        // A repeated acknowledgement never repeats its height effect.
        if input.sequence <= state.sequence {
            return Ok(TerrainAcknowledgement {
                status: self.status(),
                surface: None,
            });
        }
        let result = (|| {
            ensure(
                input.sequence == state.sequence + 1,
                "Lücke im Geländestrich",
            )?;
            ensure(
                !input.points.is_empty() && state.count + input.points.len() <= 4096,
                "Höchstens 4.096 Pfadpunkte je Strich",
            )?;
            let mut brush = state.brush.clone();
            brush.points = vec![state.last];
            brush.points.extend(&input.points);
            let length: f64 = brush
                .points
                .windows(2)
                .map(|p| (p[1][0] - p[0][0]).hypot(p[1][1] - p[0][1]))
                .sum();
            let remaining = (state.remaining - length).rem_euclid(spacing(&brush));
            let response = self.apply_terrain_section(brush, input.view, Some(state.remaining))?;
            let active = self.terrain_stroke.as_mut().expect("active stroke");
            active.sequence = input.sequence;
            active.count += input.points.len();
            active.last = *input.points.last().expect("nonempty");
            active.remaining = if remaining < 1e-9 {
                spacing(&state.brush)
            } else {
                remaining
            };
            Ok(response)
        })();
        if result.is_err() {
            self.terrain_stroke = None;
        }
        result
    }
    pub(super) fn end_terrain_stroke(&mut self, input: EndTerrainStroke) -> Result<Status> {
        if input.session_id == self.session
            && self
                .terrain_stroke
                .as_ref()
                .is_some_and(|s| s.id == input.stroke_id)
        {
            self.terrain_stroke = None;
        }
        Ok(self.status())
    }
    fn apply_terrain_section(
        &mut self,
        brush: Brush,
        view: Option<TerrainArgs>,
        offset: Option<f64>,
    ) -> Result<TerrainAcknowledgement> {
        let intent = Intent::TerrainStroke { brush, view };
        self.terrain_sampling = offset;
        let computed =
            crate::atlas::operations::compute(self, &intent, &mut PlanDiagnostics::default());
        self.terrain_sampling = None;
        let mut computed = computed?;
        let tx = self
            .db
            .unchecked_transaction()
            .map_err(crate::atlas::errors::storage_error)?;
        if let Some(delta) = &computed.change.world_terrain {
            super::world_terrain_store::apply(&tx, delta, true)?;
        }
        if let Some(delta) = &computed.change.terrain {
            super::terrain_store::write_points(&tx, &delta.after)?;
        }
        self.trim_water(&mut computed)?;
        self.refresh_rivers(&mut computed)?;
        let applied = self.stage_computed(&tx, &computed, true)?;
        let changed = Some(
            applied
                .as_ref()
                .map_or(&[][..], |a| a.hints.world.as_slice()),
        );
        self.prepare_surface_preview(&intent, &mut computed, changed)?;
        tx.commit().map_err(crate::atlas::errors::storage_error)?;
        self.publish_computed(applied);
        if let Some(surface) = computed
            .terrain_preview
            .as_mut()
            .and_then(|p| p.surface.as_mut())
        {
            surface.status = self.status();
        }
        Ok(TerrainAcknowledgement {
            status: self.status(),
            surface: computed.terrain_preview.and_then(|p| p.surface),
        })
    }
}
fn spacing(b: &Brush) -> f64 {
    (b.radius / 4.).max(2.5 * 2f64.powi(b.resolution.unwrap_or(0) as i32))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::atlas::terrain;
    use serde_json::json;
    fn start(app: &mut AtlasApplication, mode: &str) -> serde_json::Value {
        app.request("beginTerrainStroke",json!({"version":app.status(),"strokeId":"test","brush":{"resolution":0,"mode":mode,"radius":20.,"amount":1.,"strength":0.25,"target":10.,"points":[[0.,0.]]},"view":null})).unwrap()
    }
    fn append(
        app: &mut AtlasApplication,
        sequence: u32,
        points: serde_json::Value,
    ) -> serde_json::Value {
        app.request("appendTerrainStroke",json!({"sessionId":app.session,"strokeId":"test","sequence":sequence,"points":points,"view":null})).unwrap()
    }
    #[test]
    fn direct_writes_are_one_history_action_and_duplicates_do_not_paint_twice() {
        let mut app = AtlasApplication::new().unwrap();
        let before = super::super::terrain_store::grid(&app.db, [-50., -50., 100., 50.]).unwrap();
        start(&mut app, "raise");
        assert_eq!(app.status().revision, 1);
        append(&mut app, 1, json!([[30., 0.]]));
        let after = super::super::terrain_store::grid(&app.db, [-50., -50., 100., 50.]).unwrap();
        let revision = app.revision;
        append(&mut app, 1, json!([[30., 0.]]));
        assert_eq!(app.revision, revision);
        assert_eq!(app.cursor, 1);
        app.history(false).unwrap();
        assert_eq!(
            super::super::terrain_store::grid(&app.db, [-50., -50., 100., 50.]).unwrap(),
            before
        );
        app.history(true).unwrap();
        assert_eq!(
            super::super::terrain_store::grid(&app.db, [-50., -50., 100., 50.]).unwrap(),
            after
        );
    }
    #[test]
    fn packet_partition_does_not_change_height_modes() {
        for mode in ["raise", "land", "mountains", "hills", "canyon"] {
            let mut a = AtlasApplication::new().unwrap();
            let mut b = AtlasApplication::new().unwrap();
            start(&mut a, mode);
            start(&mut b, mode);
            append(&mut a, 1, json!([[3., 0.], [11., 0.], [38., 0.]]));
            append(&mut b, 1, json!([[3., 0.]]));
            append(&mut b, 2, json!([[11., 0.]]));
            append(&mut b, 3, json!([[38., 0.]]));
            assert_eq!(
                super::super::terrain_store::grid(&a.db, [-50., -50., 100., 50.]).unwrap(),
                super::super::terrain_store::grid(&b.db, [-50., -50., 100., 50.]).unwrap(),
                "{mode}"
            );
        }
    }
    #[test]
    fn feature_strokes_coarse_partition_history_and_file() {
        for mode in ["mountains", "hills", "canyon"] {
            let mut a = AtlasApplication::new().unwrap();
            let mut b = AtlasApplication::new().unwrap();
            for app in [&mut a, &mut b] {
                app.request("beginTerrainStroke", json!({"version":app.status(),"strokeId":"test",
                    "brush":{"resolution":6,"mode":mode,"radius":6400.,"featureHeight":2000.,
                    "amount":1.,"strength":0.25,"target":10.,"points":[[-3200.,-3200.]]},"view":null})).unwrap();
            }
            let points = json!([[-1280., 640.], [2240., 1920.], [3840., -320.]]);
            append(&mut a, 1, points.clone());
            for (i, point) in points.as_array().unwrap().iter().enumerate() {
                append(&mut b, i as u32 + 1, json!([point]));
            }
            let values = |app: &AtlasApplication| {
                app.db
                    .prepare("SELECT level,x,y,z FROM terrain_layers ORDER BY level,x,y")
                    .unwrap()
                    .query_map([], |r| {
                        Ok((
                            r.get::<_, i32>(0)?,
                            r.get::<_, i32>(1)?,
                            r.get::<_, i32>(2)?,
                            r.get::<_, f64>(3)?,
                        ))
                    })
                    .unwrap()
                    .collect::<rusqlite::Result<Vec<_>>>()
                    .unwrap()
            };
            let painted = values(&a);
            assert!(!painted.is_empty());
            let partitioned = values(&b);
            assert_eq!(painted.len(), partitioned.len(), "{mode} count");
            for (a, b) in painted.iter().zip(&partitioned) {
                assert_eq!((a.0, a.1, a.2), (b.0, b.1, b.2));
                assert!((a.3 - b.3).abs() < 1e-8, "{mode}: {a:?} != {b:?}");
            }
            a.history(false).unwrap();
            assert!(values(&a).is_empty());
            a.history(true).unwrap();
            assert_eq!(painted, values(&a));
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join("feature.saltatlas");
            a.save(&path).unwrap();
            a.open(&path).unwrap();
            assert_eq!(painted, values(&a));
        }
    }

    #[test]
    fn invalid_section_keeps_confirmed_history_and_ends_stroke() {
        let mut app = AtlasApplication::new().unwrap();
        start(&mut app, "land");
        let revision = app.revision;
        assert!(app.request("appendTerrainStroke",json!({"sessionId":app.session,"strokeId":"test","sequence":2,"points":[[30.,0.]],"view":null})).is_err());
        assert_eq!(app.revision, revision);
        assert!(app.terrain_stroke.is_none());
        app.history(false).unwrap();
        assert!(
            super::super::terrain_store::grid(&app.db, [-50., -50., 100., 50.])
                .unwrap()
                .is_empty()
        );
    }
    #[test]
    fn late_history_failure_rolls_back_only_the_new_section() {
        let mut app = AtlasApplication::new().unwrap();
        start(&mut app, "land");
        let before = super::super::terrain_store::grid(&app.db, [-50., -50., 100., 50.]).unwrap();
        let status = app.status();
        app.db.execute_batch("CREATE TEMP TRIGGER fail_group BEFORE INSERT ON history_sections BEGIN SELECT RAISE(ABORT,'history failure'); END;").unwrap();
        assert!(app.request("appendTerrainStroke",json!({"sessionId":app.session,"strokeId":"test","sequence":1,"points":[[30.,0.]],"view":null})).is_err());
        assert_eq!(app.status().revision, status.revision);
        assert_eq!(
            super::super::terrain_store::grid(&app.db, [-50., -50., 100., 50.]).unwrap(),
            before
        );
        app.db.execute_batch("DROP TRIGGER fail_group").unwrap();
        app.history(false).unwrap();
        assert!(
            super::super::terrain_store::grid(&app.db, [-50., -50., 100., 50.])
                .unwrap()
                .is_empty()
        );
    }
    #[test]
    fn save_closes_live_group_and_roundtrips_confirmed_values() {
        let mut app = AtlasApplication::new().unwrap();
        start(&mut app, "land");
        append(&mut app, 1, json!([[30., 0.]]));
        let before = super::super::terrain_store::grid(&app.db, [-50., -50., 100., 50.]).unwrap();
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("direct.saltatlas");
        app.save(&path).unwrap();
        assert!(app.terrain_stroke.is_none());
        assert!(app.request("appendTerrainStroke",json!({"sessionId":app.session,"strokeId":"test","sequence":2,"points":[[40.,0.]],"view":null})).is_err());
        app.history(false).unwrap();
        assert!(app.status().dirty);
        app.history(true).unwrap();
        assert!(!app.status().dirty);
        app.open(&path).unwrap();
        assert!(!app.status().can_undo);
        assert_eq!(rows(&app, "SELECT count(*) FROM history_sections"), 0);
        assert_eq!(
            super::super::terrain_store::grid(&app.db, [-50., -50., 100., 50.]).unwrap(),
            before
        );
    }

    fn rows(app: &AtlasApplication, sql: &str) -> i64 {
        app.db.query_row(sql, [], |r| r.get(0)).unwrap()
    }
    fn section_bodies(app: &AtlasApplication) -> Vec<String> {
        app.db
            .prepare("SELECT body FROM history_sections ORDER BY seq,section")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap()
    }
    #[test]
    fn appends_never_rewrite_prior_payloads_and_count_controls_once() {
        let mut app = AtlasApplication::new().unwrap();
        start(&mut app, "raise");
        let initial = section_bodies(&app);
        let count = rows(&app, "SELECT controls FROM history");
        // A stationary sampled stroke is a no-op, not another history section.
        append(&mut app, 1, json!([[0., 0.]]));
        assert_eq!(section_bodies(&app), initial);
        append(&mut app, 2, json!([[5., 0.], [0., 0.]]));
        assert_eq!(section_bodies(&app)[0], initial[0]);
        assert_eq!(rows(&app, "SELECT sections FROM history"), 2);
        assert_eq!(
            rows(&app, "SELECT controls FROM history"),
            rows(&app, "SELECT count(*) FROM history_controls")
        );
        assert!(rows(&app, "SELECT controls FROM history") < 2 * count);
        let bodies = section_bodies(&app);
        append(&mut app, 2, json!([[5., 0.], [0., 0.]]));
        assert_eq!(section_bodies(&app), bodies);
    }
    #[test]
    fn late_undo_and_redo_failure_roll_back_all_sections_and_status() {
        let mut app = AtlasApplication::new().unwrap();
        start(&mut app, "raise");
        append(&mut app, 1, json!([[30., 0.]]));
        let bounds = [-50., -50., 100., 50.];
        let painted = super::super::terrain_store::grid(&app.db, bounds).unwrap();
        for redo in [false, true] {
            if redo {
                app.history(false).unwrap();
            }
            let before = super::super::terrain_store::grid(&app.db, bounds).unwrap();
            let status = json!(app.status());
            let first = if redo { 1 } else { 0 };
            // Corrupt the second section visited, after the first has written.
            let body: String = app
                .db
                .query_row(
                    "SELECT body FROM history_sections WHERE section=?",
                    [first],
                    |r| r.get(0),
                )
                .unwrap();
            app.db
                .execute(
                    "UPDATE history_sections SET body='invalid' WHERE section=?",
                    [first],
                )
                .unwrap();
            assert!(app.history(redo).is_err());
            assert_eq!(json!(app.status()), status);
            assert_eq!(
                super::super::terrain_store::grid(&app.db, bounds).unwrap(),
                before
            );
            app.db
                .execute(
                    "UPDATE history_sections SET body=? WHERE section=?",
                    rusqlite::params![body, first],
                )
                .unwrap();
        }
        app.history(true).unwrap();
        assert_eq!(
            super::super::terrain_store::grid(&app.db, bounds).unwrap(),
            painted
        );
    }
    #[test]
    fn history_retains_actions_not_sections_and_cascades_pruned_rows() {
        let mut app = AtlasApplication::new().unwrap();
        for _ in 0..102 {
            start(&mut app, "raise");
            append(&mut app, 1, json!([[5., 0.]]));
        }
        assert_eq!(rows(&app, "SELECT count(*) FROM history"), 100);
        assert_eq!(rows(&app, "SELECT count(*) FROM history_sections"), 200);
        assert_eq!(
            rows(&app, "SELECT count(*) FROM history_controls WHERE seq<=2"),
            0
        );
        for _ in 0..100 {
            app.history(false).unwrap();
        }
        assert!(!app.status().can_undo);
        assert!(app.status().can_redo);
        start(&mut app, "raise");
        assert!(!app.status().can_redo);
        assert_eq!(rows(&app, "SELECT count(*) FROM history"), 1);
        assert_eq!(rows(&app, "SELECT count(*) FROM history_sections"), 1);
        assert_eq!(
            rows(&app, "SELECT count(*) FROM history_controls WHERE seq>3"),
            0
        );
    }
    #[test]
    fn control_limit_failure_rolls_back_keys_header_and_section() {
        let mut app = AtlasApplication::new().unwrap();
        start(&mut app, "raise");
        // Fill the real key set at distant coordinates without an enormous brush fixture.
        app.db.execute_batch("WITH RECURSIVE n(x) AS (SELECT 100000 UNION ALL SELECT x+1 FROM n WHERE x<200000) INSERT INTO history_controls SELECT 1,0,x,100000 FROM n LIMIT (100000-(SELECT count(*) FROM history_controls)); UPDATE history SET controls=100000;").unwrap();
        let status = json!(app.status());
        let bodies = section_bodies(&app);
        let before = super::super::terrain_store::grid(&app.db, [-50., -50., 100., 50.]).unwrap();
        assert!(app.request("appendTerrainStroke",json!({"sessionId":app.session,"strokeId":"test","sequence":1,"points":[[30.,0.]],"view":null})).is_err());
        assert_eq!(json!(app.status()), status);
        assert_eq!(section_bodies(&app), bodies);
        assert_eq!(rows(&app, "SELECT controls FROM history"), 100000);
        assert_eq!(rows(&app, "SELECT count(*) FROM history_controls"), 100000);
        assert_eq!(
            super::super::terrain_store::grid(&app.db, [-50., -50., 100., 50.]).unwrap(),
            before
        );
        app.history(false).unwrap();
        assert!(!app.status().dirty);
    }

    #[test]
    fn coarse_sections_restore_absent_authors_and_their_overviews() {
        let mut app = AtlasApplication::new().unwrap();
        app.request("beginTerrainStroke", json!({"version":app.status(),"strokeId":"test","brush":{"resolution":4,"mode":"land","radius":100,"amount":1,"strength":1,"target":10,"points":[[0,0]]},"view":null})).unwrap();
        append(&mut app, 1, json!([[400., 0.]]));
        let before =
            super::super::terrain_store::grid(&app.db, [-500., -500., 1000., 500.]).unwrap();
        assert!(rows(&app, "SELECT count(*) FROM terrain_layers") > 0);
        app.history(false).unwrap();
        assert_eq!(rows(&app, "SELECT count(*) FROM terrain_layers"), 0);
        super::super::terrain_blocks::refresh(&app.db).unwrap();
        assert_eq!(
            rows(&app, "SELECT count(*) FROM terrain_blocks WHERE source=4"),
            0
        );
        app.history(true).unwrap();
        assert_eq!(
            super::super::terrain_store::grid(&app.db, [-500., -500., 1000., 500.]).unwrap(),
            before
        );
    }

    #[test]
    fn canonical_coast_controls_are_independent_of_all_surface_lods() {
        let mut app = AtlasApplication::new().unwrap();
        start(&mut app, "land");
        append(&mut app, 1, json!([[80., 0.]]));
        for p in [[-15., -5.], [15., 13.], [75., -12.]] {
            let expected = terrain::height(
                &super::super::terrain_store::grid(
                    &app.db,
                    [p[0] - 10., p[1] - 10., p[0] + 10., p[1] + 10.],
                )
                .unwrap(),
                p,
            );
            for level in 0..=21 {
                let width = 160. * 2f64.powi(level);
                let response = app
                    .terrain_tiles(TerrainArgs {
                        contour_interval: None,
                        pixels: Some(32),
                        level: level as u8,
                        tiles: vec![[(p[0] / width).floor() as i32, (p[1] / width).floor() as i32]],
                    })
                    .unwrap();
                assert!(response.tiles[0].raster.is_some());
                let mut sampler = super::super::terrain_blocks::Sampler::new(&app.db).unwrap();
                assert!(
                    (sampler.height(p).unwrap() - expected).abs() < 1e-8,
                    "LOD {level}"
                );
            }
        }
    }
}

#[cfg(test)]
mod presentation_tests {
    use serde_json::{json, Value};
    #[test]
    fn acknowledgements_match_rebuild_and_content_ids_survive_history() {
        let mut app = super::super::AtlasApplication::new().unwrap();
        let view = json!({"level":0,"pixels":32,"tiles":[[-1,0],[0,0],[1,0]]});
        let read = |app: &mut super::super::AtlasApplication| {
            app.request("terrainTiles", view.clone()).unwrap()["tiles"].clone()
        };
        let before = read(&mut app);
        let first = app.request("beginTerrainStroke", json!({
            "version":app.status(),"strokeId":"display",
            "brush":{"mode":"land","resolution":0,"radius":20,"amount":1,"strength":1,"target":10,"points":[[150,20]]},
            "view":view
        })).unwrap();
        assert!(first.get("valid").is_none());
        let mut tiles = before.as_array().unwrap().clone();
        assert!(first["surface"]["tiles"].as_array().unwrap().len() < tiles.len());
        for tile in first["surface"]["tiles"].as_array().unwrap() {
            *tiles
                .iter_mut()
                .find(|t| t["x"] == tile["x"] && t["y"] == tile["y"])
                .unwrap() = tile.clone();
        }
        let append = json!({"sessionId":app.session,"strokeId":"display","sequence":1,"points":[[170,20]],"view":view});
        let next = app.request("appendTerrainStroke", append.clone()).unwrap();
        for tile in next["surface"]["tiles"].as_array().unwrap() {
            let old = tiles
                .iter_mut()
                .find(|t| t["x"] == tile["x"] && t["y"] == tile["y"])
                .unwrap();
            *old = tile.clone();
        }
        let after = read(&mut app);
        assert_eq!(Value::Array(tiles), after);
        assert_ne!(before, after);
        let repeat = app.request("appendTerrainStroke", append).unwrap();
        assert_eq!(repeat["status"], next["status"]);
        assert!(repeat["surface"].is_null());
        app.request(
            "endTerrainStroke",
            json!({"sessionId":app.session,"strokeId":"display"}),
        )
        .unwrap();
        app.request("history", json!({"version":app.status(),"redo":false}))
            .unwrap();
        assert_eq!(read(&mut app), before);
        app.request("history", json!({"version":app.status(),"redo":true}))
            .unwrap();
        assert_eq!(read(&mut app), after);
        for tile in after.as_array().unwrap() {
            assert_eq!(tile["contentId"].as_str().unwrap().len(), 64);
        }
        let coarse = app
            .request(
                "terrainTiles",
                json!({"level":0,"pixels":64,"tiles":[[0,0]]}),
            )
            .unwrap();
        assert_ne!(coarse["tiles"][0]["contentId"], after[1]["contentId"]);
    }
}
