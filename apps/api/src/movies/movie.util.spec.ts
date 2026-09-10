import { looksLikeFilesystemPath, slugify, isSafeHttpUrl, escapeRegex } from './movie.util';

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
    expect(isSafeHttpUrl('http://localhost:4000/art.jpg')).toBe(false);
    expect(isSafeHttpUrl('http://192.168.1.10/art.jpg')).toBe(false);
  });

  it('escapes regex metacharacters for search', () => {
    expect(escapeRegex('a+b(c)')).toBe('a\\+b\\(c\\)');
  });
});
