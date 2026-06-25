export interface MalGenre {
  id: number;
  name: string;
}

export type GenreGroupId = "main" | "demographic" | "theme" | "explicit";

export interface GenreGroup {
  id: GenreGroupId;
  genreIds: number[];
}

/** All MyAnimeList anime genres (IDs from official MAL taxonomy). */
export const MAL_GENRES: MalGenre[] = [
  { id: 1, name: "Action" },
  { id: 2, name: "Adventure" },
  { id: 3, name: "Racing" },
  { id: 4, name: "Comedy" },
  { id: 5, name: "Avant Garde" },
  { id: 6, name: "Mythology" },
  { id: 7, name: "Mystery" },
  { id: 8, name: "Drama" },
  { id: 9, name: "Ecchi" },
  { id: 10, name: "Fantasy" },
  { id: 11, name: "Strategy Game" },
  { id: 12, name: "Hentai" },
  { id: 13, name: "Historical" },
  { id: 14, name: "Horror" },
  { id: 15, name: "Kids" },
  { id: 17, name: "Martial Arts" },
  { id: 18, name: "Mecha" },
  { id: 19, name: "Music" },
  { id: 20, name: "Parody" },
  { id: 21, name: "Samurai" },
  { id: 22, name: "Romance" },
  { id: 23, name: "School" },
  { id: 24, name: "Sci-Fi" },
  { id: 25, name: "Shoujo" },
  { id: 26, name: "Girls Love" },
  { id: 27, name: "Shounen" },
  { id: 28, name: "Boys Love" },
  { id: 29, name: "Space" },
  { id: 30, name: "Sports" },
  { id: 31, name: "Super Power" },
  { id: 32, name: "Vampire" },
  { id: 35, name: "Harem" },
  { id: 36, name: "Slice of Life" },
  { id: 37, name: "Supernatural" },
  { id: 38, name: "Military" },
  { id: 39, name: "Detective" },
  { id: 40, name: "Psychological" },
  { id: 41, name: "Suspense" },
  { id: 42, name: "Seinen" },
  { id: 43, name: "Josei" },
  { id: 46, name: "Award Winning" },
  { id: 47, name: "Gourmet" },
  { id: 48, name: "Workplace" },
  { id: 49, name: "Erotica" },
  { id: 50, name: "Adult Cast" },
  { id: 51, name: "Anthropomorphic" },
  { id: 52, name: "CGDCT" },
  { id: 53, name: "Childcare" },
  { id: 54, name: "Combat Sports" },
  { id: 55, name: "Delinquents" },
  { id: 56, name: "Educational" },
  { id: 57, name: "Gag Humor" },
  { id: 58, name: "Gore" },
  { id: 59, name: "High Stakes Game" },
  { id: 60, name: "Idols (Female)" },
  { id: 61, name: "Idols (Male)" },
  { id: 62, name: "Isekai" },
  { id: 63, name: "Iyashikei" },
  { id: 64, name: "Love Polygon" },
  { id: 65, name: "Magical Sex Shift" },
  { id: 66, name: "Mahou Shoujo" },
  { id: 67, name: "Medical" },
  { id: 68, name: "Organized Crime" },
  { id: 69, name: "Otaku Culture" },
  { id: 70, name: "Performing Arts" },
  { id: 71, name: "Pets" },
  { id: 72, name: "Reincarnation" },
  { id: 73, name: "Reverse Harem" },
  { id: 74, name: "Love Status Quo" },
  { id: 75, name: "Showbiz" },
  { id: 76, name: "Survival" },
  { id: 77, name: "Team Sports" },
  { id: 78, name: "Time Travel" },
  { id: 79, name: "Video Game" },
  { id: 80, name: "Visual Arts" },
  { id: 81, name: "Crossdressing" },
  { id: 82, name: "Urban Fantasy" },
  { id: 83, name: "Villainess" },
];

export const GENRE_BY_ID = new Map(MAL_GENRES.map((g) => [g.id, g]));

export const GENRE_GROUPS: GenreGroup[] = [
  {
    id: "main",
    genreIds: [1, 2, 5, 46, 28, 4, 8, 10, 26, 47, 14, 7, 22, 24, 36, 30, 37, 41],
  },
  {
    id: "demographic",
    genreIds: [27, 42, 25, 43, 15],
  },
  {
    id: "theme",
    genreIds: [
      62, 18, 13, 23, 38, 19, 20, 35, 29, 21, 31, 32, 78, 48, 40, 3, 6, 11, 17, 39, 50, 51,
      52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74,
      75, 76, 77, 79, 80, 81, 82, 83,
    ],
  },
  {
    id: "explicit",
    genreIds: [9, 12, 49],
  },
];

/** @deprecated Use MAL_GENRES — kept for any legacy imports */
export const GENRES = MAL_GENRES;
