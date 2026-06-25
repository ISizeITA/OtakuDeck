pub fn split_text(text: &str, max_len: usize) -> Vec<String> {
    if text.len() <= max_len {
        return vec![text.to_string()];
    }

    let mut chunks = Vec::new();
    let mut current = String::new();

    for paragraph in text.split("\n\n") {
        let candidate = if current.is_empty() {
            paragraph.to_string()
        } else {
            format!("{current}\n\n{paragraph}")
        };

        if candidate.len() <= max_len {
            current = candidate;
            continue;
        }

        if !current.is_empty() {
            chunks.push(current);
            current = String::new();
        }

        if paragraph.len() <= max_len {
            current = paragraph.to_string();
            continue;
        }

        for sentence in paragraph.split(". ") {
            let piece = if sentence.ends_with('.') {
                sentence.to_string()
            } else {
                format!("{sentence}.")
            };

            if current.len() + piece.len() + 1 <= max_len {
                if !current.is_empty() {
                    current.push(' ');
                }
                current.push_str(&piece);
            } else {
                if !current.is_empty() {
                    chunks.push(current);
                }
                current = piece;
            }
        }
    }

    if !current.is_empty() {
        chunks.push(current);
    }

    if chunks.is_empty() {
        chunks.push(text.chars().take(max_len).collect());
    }

    chunks
}

#[cfg(test)]
mod tests {
    use super::split_text;

    #[test]
    fn split_short_text_unchanged() {
        let parts = split_text("Hello world", 100);
        assert_eq!(parts, vec!["Hello world"]);
    }
}
