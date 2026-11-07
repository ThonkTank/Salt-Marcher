#[path = "support/adapter.rs"]
mod adapter;

use saltmarcher::document_worker::DocumentWorker;
use serde_json::{json, Value};
use std::io::{self, BufRead, Write};
fn main() {
    let worker = DocumentWorker::new();
    // A blocking reader owns stdin; bounded admission models concurrent native
    // invokes without allowing an unbounded backlog outside DocumentWorker.
    let (sender, receiver) = tokio::sync::mpsc::channel(adapter::CAPACITY);
    std::thread::spawn(move || {
        for line in io::stdin().lock().lines() {
            let failed = line.is_err();
            if sender.blocking_send(line).is_err() || failed {
                break;
            }
        }
    });
    let stdout = io::stdout();
    let mut output = stdout.lock();
    tauri::async_runtime::block_on(adapter::serve(
        receiver,
        |line| respond(&worker, line),
        |reply| {
            writeln!(output, "{reply}")?;
            output.flush()
        },
        adapter::CAPACITY,
    ))
    .expect("test adapter output failed");
}

async fn respond(worker: &DocumentWorker, line: io::Result<String>) -> Value {
    let input = match line
        .map_err(|e| e.to_string())
        .and_then(|line| serde_json::from_str::<Value>(&line).map_err(|e| e.to_string()))
    {
        Ok(input) => input,
        Err(error) => return json!({"error":error}),
    };
    let Some(cmd) = input["cmd"].as_str() else {
        return json!({"error":"Befehl fehlt"});
    };
    let args = input.get("args").cloned().unwrap_or(json!({}));
    let started = std::time::Instant::now();
    let result = worker.request(cmd.into(), args).await;
    let elapsed = started.elapsed().as_secs_f64() * 1000.;
    let mut reply = match result {
        Ok(value) => json!({"value":value}),
        Err(error) => json!({"error":error}),
    };
    if std::env::var_os("ATLAS_MEASURE_WORKER").is_some() {
        reply["workerMs"] = json!(elapsed);
    }
    reply
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn protocol_errors_keep_the_response_envelope() {
        let worker = DocumentWorker::new();
        let replies = tauri::async_runtime::block_on(async {
            [
                respond(&worker, Ok("not json".into())).await,
                respond(&worker, Ok("{}".into())).await,
                respond(&worker, Err(io::Error::other("stdin failed"))).await,
            ]
        });
        for reply in &replies {
            assert!(reply["error"].is_string());
            assert!(reply.get("value").is_none());
        }
        assert_eq!(replies[1]["error"], "Befehl fehlt");
        assert_eq!(replies[2]["error"], "stdin failed");
    }
}
