import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { api } from "@/lib/api";
import { getCoverUrl, type AnimeNode } from "@/types/mal";

interface CachedCoverProps {
  anime: Pick<AnimeNode, "id" | "title" | "main_picture">;
  className?: string;
  alt?: string;
}

export function CachedCover({ anime, className, alt = "" }: CachedCoverProps) {
  const remote = getCoverUrl(anime as AnimeNode);
  const [src, setSrc] = useState(remote);

  useEffect(() => {
    let cancelled = false;
    setSrc(remote);

    const medium = anime.main_picture?.large ?? anime.main_picture?.medium;
    if (!medium) return;

    void api
      .cacheAnimeCover(anime.id, medium)
      .then((path) => {
        if (cancelled) return;
        setSrc(convertFileSrc(path));
      })
      .catch(() => {
        if (!cancelled) setSrc(remote);
      });

    return () => {
      cancelled = true;
    };
  }, [anime.id, remote, anime.main_picture?.large, anime.main_picture?.medium]);

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => {
        if (src !== remote) setSrc(remote);
      }}
    />
  );
}
