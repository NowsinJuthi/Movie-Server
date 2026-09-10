import { ConfigService } from '@nestjs/config';
import { TmdbMetadataService } from './tmdb-metadata.service';

describe('TmdbMetadataService', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns null when no API key is configured', async () => {
    const tmdb = new TmdbMetadataService({ get: () => '' } as unknown as ConfigService);
    expect(tmdb.enabled()).toBe(false);
    await expect(tmdb.searchMovie('Extraction 2', 2023)).resolves.toBeNull();
  });

  it('maps a TMDB search hit into catalog metadata', async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search/movie')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                id: 42,
                title: 'Extraction 2',
                overview: 'A mercenary is pulled back in.',
                release_date: '2023-06-16',
                poster_path: '/poster.jpg',
                backdrop_path: '/back.jpg',
                vote_average: 7.2,
                genre_ids: [28, 53],
              },
            ],
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          id: 42,
          title: 'Extraction 2',
          overview: 'A mercenary is pulled back in.',
          release_date: '2023-06-16',
          runtime: 123,
          poster_path: '/poster.jpg',
          backdrop_path: '/back.jpg',
          vote_average: 7.2,
          genres: [
            { id: 28, name: 'Action' },
            { id: 53, name: 'Thriller' },
          ],
        }),
      } as Response;
    }) as typeof fetch;

    const tmdb = new TmdbMetadataService({ get: () => 'test-key' } as unknown as ConfigService);
    const meta = await tmdb.searchMovie('Extraction 2', 2023);
    expect(meta).toMatchObject({
      title: 'Extraction 2',
      year: 2023,
      runtimeMinutes: 123,
      genres: ['action', 'thriller'],
      posterPath: '/poster.jpg',
      cast: [],
      directors: [],
      writers: [],
    });
  });

  it('rejects unexpected image paths', async () => {
    const tmdb = new TmdbMetadataService({ get: () => 'test-key' } as unknown as ConfigService);
    await expect(tmdb.downloadPoster('https://evil.example/x.jpg')).resolves.toBeNull();
    await expect(tmdb.downloadPoster('/../secret.jpg')).resolves.toBeNull();
  });
});
