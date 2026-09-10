import { stripExtension, toPosixRelative } from '../matching/filename-parser';

const POSTER_FILES = [
  'poster.jpg',
  'poster.jpeg',
  'poster.png',
  'poster.webp',
  'folder.jpg',
  'folder.jpeg',
  'folder.png',
  'cover.jpg',
  'cover.png',
  'movie.jpg',
];

const BACKDROP_FILES = ['fanart.jpg', 'fanart.png', 'backdrop.jpg', 'backdrop.png', 'background.jpg'];

function joinPosix(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

export function localArtworkKeys(relativePath: string): { posters: string[]; backdrops: string[] } {
  const posix = toPosixRelative(relativePath);
  const slash = posix.lastIndexOf('/');
  const dir = slash >= 0 ? posix.slice(0, slash) : '';
  const fileName = slash >= 0 ? posix.slice(slash + 1) : posix;
  const stem = stripExtension(fileName);

  const posters = [
    ...POSTER_FILES.map((name) => joinPosix(dir, name)),
    joinPosix(dir, `${stem}.jpg`),
    joinPosix(dir, `${stem}.png`),
    joinPosix(dir, `${stem}-poster.jpg`),
    joinPosix(dir, `${stem}-poster.png`),
  ].filter((key) => key !== posix);

  const backdrops = BACKDROP_FILES.map((name) => joinPosix(dir, name)).filter((key) => key !== posix);

  return { posters: [...new Set(posters)], backdrops: [...new Set(backdrops)] };
}
