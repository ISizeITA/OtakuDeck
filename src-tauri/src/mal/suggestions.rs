use std::collections::{HashMap, HashSet};

use super::client::{MalClient, MalError};
use super::types::{AnimeListEntry, AnimeNode, ANIME_CARD_FIELDS};

const TARGET: usize = 12;
const MAX_SCAN: u32 = 500;

pub async fn compute_suggestions(token: &str) -> Result<Vec<AnimeNode>, MalError> {
    let list = MalClient::fetch_all_user_animelist(token).await?;
    compute_suggestions_from_list(token, &list).await
}

pub async fn compute_suggestions_from_list(
    token: &str,
    list: &[AnimeListEntry],
) -> Result<Vec<AnimeNode>, MalError> {
    let user_set: HashSet<u64> = list.iter().map(|entry| entry.node.id).collect();
    let target_genre_id = top_genre_from_list(list);
    collect_suggestions(token, &user_set, target_genre_id).await
}

fn top_genre_from_list(list: &[AnimeListEntry]) -> Option<u64> {
    let mut genre_scores: HashMap<u64, f64> = HashMap::new();

    for entry in list {
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

    genre_scores
        .into_iter()
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(id, _)| id)
}

async fn collect_suggestions(
    token: &str,
    user_set: &HashSet<u64>,
    genre_id: Option<u64>,
) -> Result<Vec<AnimeNode>, MalError> {
    let mut results = Vec::new();
    let mut offset = 0u32;

    while results.len() < TARGET && offset < MAX_SCAN {
        let ranking = MalClient::get_anime_ranking_with_fields(
            token,
            "bypopularity",
            100,
            offset,
            ANIME_CARD_FIELDS,
        )
        .await?;

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
        tokio::time::sleep(std::time::Duration::from_millis(350)).await;
    }

    Ok(results)
}
