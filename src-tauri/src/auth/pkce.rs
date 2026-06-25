use rand::Rng;
use thiserror::Error;

const PKCE_CHARSET: &[u8] =
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

#[derive(Debug, Clone)]
pub struct PkcePair {
    pub verifier: String,
    pub challenge: String,
}

#[derive(Error, Debug)]
pub enum PkceError {
    #[error("failed to generate random bytes")]
    Random,
}

/// Generates a PKCE code_verifier (43–128 chars) and code_challenge.
/// MAL currently supports only the `plain` method: challenge == verifier.
pub fn generate_pkce_pair() -> Result<PkcePair, PkceError> {
    let mut rng = rand::thread_rng();
    let length = rng.gen_range(43..=128);
    let verifier: String = (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..PKCE_CHARSET.len());
            PKCE_CHARSET[idx] as char
        })
        .collect();

    Ok(PkcePair {
        challenge: verifier.clone(),
        verifier,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pkce_verifier_length_is_valid() {
        let pair = generate_pkce_pair().unwrap();
        assert!(pair.verifier.len() >= 43);
        assert!(pair.verifier.len() <= 128);
        assert_eq!(pair.verifier, pair.challenge);
    }
}
