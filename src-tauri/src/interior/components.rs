use std::collections::BTreeSet;

pub(crate) fn cell_components(set: &BTreeSet<(i64, i64)>) -> Vec<BTreeSet<(i64, i64)>> {
    let mut left = set.clone();
    let mut result = Vec::new();
    while let Some(&start) = left.iter().next() {
        left.remove(&start);
        let mut part = BTreeSet::new();
        let mut queue = vec![start];
        while let Some((x, y)) = queue.pop() {
            part.insert((x, y));
            for p in [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)] {
                if left.remove(&p) {
                    queue.push(p);
                }
            }
        }
        result.push(part);
    }
    result.sort_by_key(|p| {
        (
            std::cmp::Reverse(p.len()),
            p.iter().map(|(x, y)| (*y, *x)).min().unwrap(),
        )
    });
    result
}
