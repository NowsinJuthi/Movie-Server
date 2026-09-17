import {
  looksLikeFilesystemPath,
  resolvePublicArtworkUrl,
  slugify,
  isSafeHttpUrl,
  escapeRegex,
} from './movie.util';

describe('movie.util', () => {
  it('slugifies titles', () => {
    expect(slugify('The Dark Knight')).toBe('the-dark-knight');
    expect(slugify('  Spaced  Out!! ')).toBe('spaced-out');
  });

  it('rejects filesystem paths and file URLs', () => {
    expect(looksLikeFilesystemPath('C:\\Movies\\film.mkv')).toBe(true);
    expect(looksLikeFilesystemPath('/var/media/film.mkv')).toBe(true);
    expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeHttpUrl('https://cdn.example.com/poster.jpg')).toBe(true);
    expect(isSafeHttpUrl('http://localhost:4001/art.jpg')).toBe(false);
    expect(isSafeHttpUrl('http://192.168.1.10/art.jpg')).toBe(false);
  });

  it('escapes regex metacharacters for search', () => {
    expect(escapeRegex('a+b(c)')).toBe('a\\+b\\(c\\)');
  });

  it('resolves artwork keys and rejects filesystem poster paths', () => {
    expect(resolvePublicArtworkUrl(null, 'a1b2c3d4e5f6789012345678abcdef01.jpg')).toBe(
      '/api/v1/media/artwork/a1b2c3d4e5f6789012345678abcdef01.jpg',
    );
    expect(resolvePublicArtworkUrl('C:\\Movies\\poster.jpg', null)).toBeNull();
    expect(resolvePublicArtworkUrl('https://image.tmdb.org/poster.jpg', null)).toBe(
      'https://image.tmdb.org/poster.jpg',
    );
  });
});
