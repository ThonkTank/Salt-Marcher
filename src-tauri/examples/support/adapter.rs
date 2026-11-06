//! Concurrent native-style request admission with FIFO JSONL replies.
use std::collections::VecDeque;
use std::future::{poll_fn, Future};
use std::io;
use std::pin::Pin;
use std::task::Poll;
use tokio::sync::mpsc;

pub const CAPACITY: usize = 32;

struct Pending<F: Future> {
    future: Pin<Box<F>>,
    reply: Option<F::Output>,
}

pub async fn serve<T, F, Start, Emit>(
    mut input: mpsc::Receiver<T>,
    mut start: Start,
    mut emit: Emit,
    capacity: usize,
) -> io::Result<()>
where
    F: Future,
    Start: FnMut(T) -> F,
    Emit: FnMut(F::Output) -> io::Result<()>,
{
    assert!(capacity > 0);
    let mut pending: VecDeque<Pending<F>> = VecDeque::new();
    let mut eof = false;
    poll_fn(|cx| loop {
        let mut progressed = false;
        while !eof && pending.len() < capacity {
            match input.poll_recv(cx) {
                Poll::Ready(Some(value)) => {
                    pending.push_back(Pending {
                        future: Box::pin(start(value)),
                        reply: None,
                    });
                    progressed = true;
                }
                Poll::Ready(None) => {
                    eof = true;
                    break;
                }
                Poll::Pending => break,
            }
        }
        // First polls are in input order. In particular, worker channel send
        // futures acquire their admission positions before the next request.
        for request in &mut pending {
            if request.reply.is_none() {
                if let Poll::Ready(reply) = request.future.as_mut().poll(cx) {
                    request.reply = Some(reply);
                }
            }
        }
        // Even immediate parse errors must wait behind older worker responses.
        while pending
            .front()
            .is_some_and(|request| request.reply.is_some())
        {
            let reply = pending.pop_front().unwrap().reply.unwrap();
            if let Err(error) = emit(reply) {
                return Poll::Ready(Err(error));
            }
            progressed = true;
        }
        if eof && pending.is_empty() {
            return Poll::Ready(Ok(()));
        }
        if !progressed {
            return Poll::Pending;
        }
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::rc::Rc;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use std::task::{Context, Wake, Waker};
    use tokio::sync::oneshot;

    #[derive(Default)]
    struct WakeCount(AtomicUsize);
    impl Wake for WakeCount {
        fn wake(self: Arc<Self>) {
            self.0.fetch_add(1, Ordering::SeqCst);
        }
    }

    type Input = (usize, oneshot::Receiver<Result<usize, &'static str>>);
    async fn controlled(
        (id, receiver): Input,
        admitted: Rc<RefCell<Vec<usize>>>,
    ) -> Result<usize, &'static str> {
        admitted.borrow_mut().push(id);
        receiver.await.unwrap_or(Err("reply dropped"))
    }

    #[test]
    fn admits_in_order_while_first_pending_and_emits_fifo_even_for_errors() {
        let (tx, rx) = mpsc::channel(4);
        let (a, ar) = oneshot::channel();
        let (b, br) = oneshot::channel();
        let (c, cr) = oneshot::channel();
        tx.try_send((0, ar)).unwrap();
        tx.try_send((1, br)).unwrap();
        tx.try_send((2, cr)).unwrap();
        let admitted = Rc::new(RefCell::new(Vec::new()));
        let replies = Rc::new(RefCell::new(Vec::new()));
        let mut run = Box::pin(serve(
            rx,
            |v| controlled(v, admitted.clone()),
            |v| {
                replies.borrow_mut().push(v);
                Ok(())
            },
            4,
        ));
        let waker = Waker::from(Arc::new(WakeCount::default()));
        let mut cx = Context::from_waker(&waker);
        assert!(run.as_mut().poll(&mut cx).is_pending());
        assert_eq!(*admitted.borrow(), [0, 1, 2]);
        c.send(Ok(2)).unwrap();
        b.send(Err("malformed input")).unwrap();
        assert!(run.as_mut().poll(&mut cx).is_pending());
        assert!(replies.borrow().is_empty());
        a.send(Ok(0)).unwrap();
        drop(tx);
        assert!(matches!(run.as_mut().poll(&mut cx), Poll::Ready(Ok(()))));
        assert_eq!(*replies.borrow(), [Ok(0), Err("malformed input"), Ok(2)]);
    }

    #[test]
    fn bounds_active_and_buffered_requests_and_drains_eof() {
        let (tx, rx) = mpsc::channel(2);
        let admitted = Rc::new(RefCell::new(Vec::new()));
        let replies = Rc::new(RefCell::new(Vec::new()));
        let mut gates = Vec::new();
        let mut run = Box::pin(serve(
            rx,
            |v| controlled(v, admitted.clone()),
            |v| {
                replies.borrow_mut().push(v);
                Ok(())
            },
            2,
        ));
        let waker = Waker::from(Arc::new(WakeCount::default()));
        let mut cx = Context::from_waker(&waker);
        for id in 0..4 {
            let (gate, receiver) = oneshot::channel();
            tx.try_send((id, receiver)).unwrap();
            gates.push(gate);
            assert!(run.as_mut().poll(&mut cx).is_pending());
        }
        assert_eq!(*admitted.borrow(), [0, 1]);
        let (_gate, receiver) = oneshot::channel();
        assert!(matches!(
            tx.try_send((4, receiver)),
            Err(mpsc::error::TrySendError::Full(_))
        ));
        drop(tx);
        // EOF cannot discard either the active or the bounded buffered inputs.
        for (id, gate) in gates.into_iter().enumerate() {
            gate.send(Ok(id)).unwrap();
        }
        assert!(matches!(run.as_mut().poll(&mut cx), Poll::Ready(Ok(()))));
        assert_eq!(*admitted.borrow(), [0, 1, 2, 3]);
        assert_eq!(*replies.borrow(), [Ok(0), Ok(1), Ok(2), Ok(3)]);
    }

    #[test]
    fn late_input_wakes_idle_pump_and_dropped_reply_does_not_lose_next_input() {
        let (tx, rx) = mpsc::channel(2);
        let admitted = Rc::new(RefCell::new(Vec::new()));
        let replies = Rc::new(RefCell::new(Vec::new()));
        let mut run = Box::pin(serve(
            rx,
            |v| controlled(v, admitted.clone()),
            |v| {
                replies.borrow_mut().push(v);
                Ok(())
            },
            2,
        ));
        let wakes = Arc::new(WakeCount::default());
        let waker = Waker::from(wakes.clone());
        let mut cx = Context::from_waker(&waker);
        assert!(run.as_mut().poll(&mut cx).is_pending());
        let (gate, receiver) = oneshot::channel();
        tx.try_send((0, receiver)).unwrap();
        assert!(wakes.0.load(Ordering::SeqCst) > 0);
        drop(gate);
        assert!(run.as_mut().poll(&mut cx).is_pending());
        let (gate, receiver) = oneshot::channel();
        tx.try_send((1, receiver)).unwrap();
        gate.send(Ok(1)).unwrap();
        drop(tx);
        assert!(matches!(run.as_mut().poll(&mut cx), Poll::Ready(Ok(()))));
        assert_eq!(*replies.borrow(), [Err("reply dropped"), Ok(1)]);
    }

    #[test]
    fn output_failure_closes_admission_instead_of_accepting_late_input() {
        let (tx, rx) = mpsc::channel(2);
        tx.try_send(0).unwrap();
        let mut run = Box::pin(serve(
            rx,
            std::future::ready,
            |_| Err(io::Error::new(io::ErrorKind::BrokenPipe, "closed stdout")),
            2,
        ));
        let waker = Waker::from(Arc::new(WakeCount::default()));
        let mut cx = Context::from_waker(&waker);
        assert!(
            matches!(run.as_mut().poll(&mut cx), Poll::Ready(Err(e)) if e.kind() == io::ErrorKind::BrokenPipe)
        );
        drop(run);
        assert!(matches!(
            tx.try_send(1),
            Err(mpsc::error::TrySendError::Closed(_))
        ));
    }
}
