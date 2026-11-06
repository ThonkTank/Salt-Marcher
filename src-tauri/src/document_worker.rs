//! Serial document ownership and asynchronous request/reply boundary.
use crate::atlas::{AppError, AtlasApplication, Result, Status, Version};
use serde_json::Value;
use std::path::PathBuf;
use tokio::sync::{mpsc, oneshot};

const QUEUE_CAPACITY: usize = 32;
fn unavailable() -> AppError {
    AppError::storage("Der Dokument-Worker ist nicht verfügbar; das Ergebnis einer angenommenen Änderung kann unbekannt sein.")
}
fn check(app: &AtlasApplication, version: &Version) -> Result<()> {
    let current = app.status();
    if current.session_id != version.session_id || current.revision != version.revision {
        return Err(AppError::stale(
            "Die Atlas-Sitzung oder Revision ist veraltet",
        ));
    }
    Ok(())
}
type Reply<T> = oneshot::Sender<Result<T>>;
enum Message {
    Request {
        cmd: String,
        args: Value,
        reply: Reply<Value>,
    },
    Status(Reply<Status>),
    Path(Version, Reply<Option<PathBuf>>),
    Open(Version, PathBuf, Reply<Status>),
    Save(Version, PathBuf, Reply<Status>),
    Shutdown(oneshot::Sender<()>),
    #[cfg(test)]
    Block(std::sync::mpsc::Sender<()>, std::sync::mpsc::Receiver<()>),
    #[cfg(test)]
    Panic,
}
fn execute<T>(
    app: &mut Result<AtlasApplication>,
    operation: impl FnOnce(&mut AtlasApplication) -> Result<T>,
) -> Result<T> {
    match app {
        Ok(app) => operation(app),
        Err(error) => Err(error.clone()),
    }
}
#[derive(Clone)]
pub struct DocumentWorker {
    sender: mpsc::Sender<Message>,
}
impl Default for DocumentWorker {
    fn default() -> Self {
        Self::new()
    }
}
impl DocumentWorker {
    pub fn new() -> Self {
        let (sender, mut receiver) = mpsc::channel::<Message>(QUEUE_CAPACITY);
        let _ = std::thread::Builder::new()
            .name("atlas-document".into())
            .spawn(move || {
                let mut app = AtlasApplication::new();
                while let Some(message) = receiver.blocking_recv() {
                    macro_rules! respond {
                        ($reply:expr, $operation:expr) => {{
                            let _ = $reply.send(execute(&mut app, $operation));
                        }};
                    }
                    match message {
                        Message::Request { cmd, args, reply } => {
                            respond!(reply, |app| app.request(&cmd, args))
                        }
                        Message::Status(reply) => respond!(reply, |app| Ok(app.status())),
                        Message::Path(version, reply) => respond!(reply, |app| {
                            check(app, &version)?;
                            Ok(app.path().map(PathBuf::from))
                        }),
                        Message::Open(version, path, reply) => respond!(reply, |app| {
                            check(app, &version)?;
                            app.open(&path)
                        }),
                        Message::Save(version, path, reply) => respond!(reply, |app| {
                            check(app, &version)?;
                            app.save(&path)
                        }),
                        Message::Shutdown(done) => {
                            drop(app);
                            let _ = done.send(());
                            break;
                        }
                        #[cfg(test)]
                        Message::Block(ready, release) => {
                            let _ = ready.send(());
                            let _ = release.recv();
                        }
                        #[cfg(test)]
                        Message::Panic => panic!("worker failure test"),
                    }
                }
            });
        Self { sender }
    }
    async fn send<T>(&self, build: impl FnOnce(Reply<T>) -> Message) -> Result<T> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(build(tx))
            .await
            .map_err(|_| unavailable())?;
        rx.await.map_err(|_| unavailable())?
    }
    pub async fn request(&self, cmd: String, args: Value) -> Result<Value> {
        self.send(|reply| Message::Request { cmd, args, reply })
            .await
    }
    pub async fn status(&self) -> Result<Status> {
        self.send(Message::Status).await
    }
    pub async fn path(&self, version: Version) -> Result<Option<PathBuf>> {
        self.send(|r| Message::Path(version, r)).await
    }
    pub async fn open(&self, version: Version, path: PathBuf) -> Result<Status> {
        self.send(|r| Message::Open(version, path, r)).await
    }
    pub async fn save(&self, version: Version, path: PathBuf) -> Result<Status> {
        self.send(|r| Message::Save(version, path, r)).await
    }
    pub async fn shutdown(&self) {
        let (done, finished) = oneshot::channel();
        if self.sender.send(Message::Shutdown(done)).await.is_ok() {
            let _ = finished.await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn run<T>(f: impl std::future::Future<Output = T>) -> T {
        tauri::async_runtime::block_on(f)
    }
    fn message(cmd: &str, args: Value, reply: Reply<Value>) -> Message {
        Message::Request {
            cmd: cmd.into(),
            args,
            reply,
        }
    }
    // Preserve the retired queue experiment's FIFO burst/commit/latest assertions.
    #[test]
    fn preview_burst_precedes_commit_and_latest_uses_confirmed_revision() {
        for burst in [1, 10] {
            let worker = DocumentWorker::new();
            let status = run(worker.status()).unwrap();
            let created = run(worker.request("commit".into(), json!({"version":status,"intent":{
                "type":"createRoad","road":{"name":"Queue road","width":15,"material":"earth",
                "nodes":[{"point":[0,0],"incoming":null,"outgoing":null},{"point":[3000,0],"incoming":null,"outgoing":null}]},"population":null
            }}))).unwrap();
            let version = created["status"].clone();
            let road_id = created["objects"][0]["id"].clone();
            let preview = |seed| json!({"type":"populate","roadId":road_id,"settings":{"side":"both","setback":10,"gap":10,"minWidth":2,"maxWidth":4,"minDepth":2,"maxDepth":4,"seed":seed,"parcelDepth":null}});
            let (ready_tx, ready_rx) = std::sync::mpsc::channel();
            let (release_tx, release_rx) = std::sync::mpsc::channel();
            worker
                .sender
                .blocking_send(Message::Block(ready_tx, release_rx))
                .unwrap();
            ready_rx.recv().unwrap();
            let mut replies = Vec::new();
            for seed in 0..burst {
                let (tx, rx) = oneshot::channel();
                worker
                    .sender
                    .blocking_send(message(
                        "preview",
                        json!({"version":version,"intent":preview(seed)}),
                        tx,
                    ))
                    .unwrap();
                replies.push(rx);
            }
            let (tx, rx) = oneshot::channel();
            worker.sender.blocking_send(message("commit", json!({"version":version,"intent":{"type":"rename","id":road_id,"name":"After burst"}}), tx)).unwrap();
            release_tx.send(()).unwrap();
            for reply in replies {
                let response = reply.blocking_recv().unwrap().unwrap();
                assert_eq!(response["valid"], true);
                assert_eq!(response["status"]["revision"], version["revision"]);
            }
            let edit = rx.blocking_recv().unwrap().unwrap();
            assert_eq!(
                edit["status"]["revision"].as_u64().unwrap(),
                version["revision"].as_u64().unwrap() + 1
            );
            let latest = run(worker.request(
                "preview".into(),
                json!({"version":edit["status"],"intent":preview(99)}),
            ))
            .unwrap();
            assert_eq!(latest["valid"], true);
            assert_eq!(latest["status"], edit["status"]);
            assert_eq!(
                latest["objects"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .find(|object| object["kind"] == "road")
                    .unwrap()["name"],
                "After burst"
            );
            run(worker.shutdown());
        }
    }
    #[test]
    fn blocked_worker_does_not_block_caller_and_orders_save_after_edit() {
        let worker = DocumentWorker::new();
        let status = run(worker.status()).unwrap();
        let (ready_tx, ready_rx) = std::sync::mpsc::channel();
        let (release_tx, release_rx) = std::sync::mpsc::channel();
        worker
            .sender
            .blocking_send(Message::Block(ready_tx, release_rx))
            .unwrap();
        ready_rx.recv().unwrap();
        let (edit_tx, edit_rx) = oneshot::channel();
        worker.sender.blocking_send(message("commit", json!({"version":status,"intent":{"type":"createHouse","parcelId":null,"transform":{"x":0,"y":0,"angle":0},"width":4,"depth":5}}), edit_tx)).unwrap();
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("atlas.saltatlas");
        let version = Version {
            session_id: status.session_id.clone(),
            revision: status.revision + 1,
        };
        let (save_tx, save_rx) = oneshot::channel();
        worker
            .sender
            .blocking_send(Message::Save(version, path.clone(), save_tx))
            .unwrap();
        assert!(!path.exists()); // The caller reached this point while core work is blocked.
        release_tx.send(()).unwrap();
        edit_rx.blocking_recv().unwrap().unwrap();
        let saved = save_rx.blocking_recv().unwrap().unwrap();
        assert!(!saved.dirty);
        assert!(path.exists());
        let scene = run(worker.request(
            "scene".into(),
            json!({"context":{"kind":"exterior"},"bounds":[-100,-100,100,100]}),
        ))
        .unwrap();
        assert_eq!(scene["objects"].as_array().unwrap().len(), 1);
    }
    #[test]
    fn stale_file_version_and_lost_commit_reply_do_not_replay() {
        let worker = DocumentWorker::new();
        let status = run(worker.status()).unwrap();
        let old = Version {
            session_id: status.session_id.clone(),
            revision: status.revision,
        };
        let (tx, rx) = oneshot::channel();
        worker.sender.blocking_send(message("commit", json!({"version":status,"intent":{"type":"createHouse","parcelId":null,"transform":{"x":0,"y":0,"angle":0},"width":4,"depth":5}}), tx)).unwrap();
        drop(rx);
        let now = run(worker.status()).unwrap();
        assert_eq!(now.revision, old.revision + 1);
        assert!(run(worker.path(old.clone())).is_err());
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("stale.saltatlas");
        assert!(run(worker.save(old.clone(), path.clone())).is_err());
        assert!(run(worker.open(old, path.clone())).is_err());
        assert!(!path.exists());
        let scene = run(worker.request(
            "scene".into(),
            json!({"context":{"kind":"exterior"},"bounds":[-100,-100,100,100]}),
        ))
        .unwrap();
        assert_eq!(scene["objects"].as_array().unwrap().len(), 1);
    }
    #[test]
    fn queue_capacity_applies_backpressure() {
        let worker = DocumentWorker::new();
        let (ready_tx, ready_rx) = std::sync::mpsc::channel();
        let (release_tx, release_rx) = std::sync::mpsc::channel();
        worker
            .sender
            .blocking_send(Message::Block(ready_tx, release_rx))
            .unwrap();
        ready_rx.recv().unwrap();
        let mut replies = Vec::new();
        for _ in 0..QUEUE_CAPACITY {
            let (tx, rx) = oneshot::channel();
            worker.sender.try_send(Message::Status(tx)).unwrap();
            replies.push(rx);
        }
        let (tx, _) = oneshot::channel();
        assert!(matches!(
            worker.sender.try_send(Message::Status(tx)),
            Err(mpsc::error::TrySendError::Full(_))
        ));
        release_tx.send(()).unwrap();
        for rx in replies {
            rx.blocking_recv().unwrap().unwrap();
        }
    }
    #[test]
    fn worker_failure_releases_queued_and_future_responses() {
        let worker = DocumentWorker::new();
        let (ready_tx, ready_rx) = std::sync::mpsc::channel();
        let (release_tx, release_rx) = std::sync::mpsc::channel();
        worker
            .sender
            .blocking_send(Message::Block(ready_tx, release_rx))
            .unwrap();
        ready_rx.recv().unwrap();
        worker.sender.blocking_send(Message::Panic).unwrap();
        let (tx, rx) = oneshot::channel();
        worker.sender.blocking_send(Message::Status(tx)).unwrap();
        release_tx.send(()).unwrap();
        assert!(rx.blocking_recv().is_err());
        assert!(run(worker.status()).is_err());
    }
}
