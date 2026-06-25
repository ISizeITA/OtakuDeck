use std::collections::HashSet;

use super::client::{MalClient, MalError};
use super::types::AnimeNode;

const TARGET: usize = 12;
const MAX_SCAN: u32 = 500;

pub async fn compute_suggestions(token: &str) -> Result<Vec<AnimeNode>, MalError> {
    let user_ids = MalClient::get_all_user_anime_ids(token).await?;
    let user_set: HashSet<u64> = user_ids.into_iter().collect();

    let list = MalClient::get_user_animelist(token, None, 100, 0).await?;

    let mut genre_scores: std::collections::HashMap<u64, f64> = std::collections::HashMap::new();

    for entry in &list.data {
        let score = entry
            .list_status
            .as_ref()
            .and_then(|s| s.score)
            .unwrap_or(0) as f64;
        let status = entry
            .list_status
            .as_ref()
            .and_then(|s| s.status.as_deref())
            .unwrap_or("");

        let weight = if score >= 8.0 {
            score
        } else if status == "completed" && score >= 6.0 {
            score * 0.8
        } else if status == "watching" {
            5.0
        } else {
            continue;
        };

        if let Some(genres) = &entry.node.genres {
            for g in genres {
                *genre_scores.entry(g.id).or_insert(0.0) += weight;
            }
        }
    }

    let target_genre_id = genre_scores
        .into_iter()
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(id, _)| id);

    collect_suggestions(token, &user_set, target_genre_id).await
}

async fn collect_suggestions(
    token: &str,
    user_set: &HashSet<u64>,
    genre_id: Option<u64>,
) -> Result<Vec<AnimeNode>, MalError> {
    let mut results = Vec::new();
    let mut offset = 0u32;

    while results.len() < TARGET && offset < MAX_SCAN {
        let ranking = MalClient::get_anime_ranking(token, "bypopularity", 100, offset).await?;

        for entry in ranking.data {
            let node = entry.node;
            if user_set.contains(&node.id) {
                continue;
            }
            if let Some(gid) = genre_id {
                let matches_genre = node
                    .genres
                    .as_ref()
                    .map(|gs| gs.iter().any(|g| g.id == gid))
                    .unwrap_or(false);
                if !matches_genre {
                    continue;
                }
            }
            results.push(node);
            if results.len() >= TARGET {
                break;
            }
        }

        if ranking.paging.as_ref().and_then(|p| p.next.as_ref()).is_none() {
            break;
        }
        offset += 100;
    }

    Ok(results)
}
