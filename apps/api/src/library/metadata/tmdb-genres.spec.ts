import { mapTmdbGenres } from './tmdb-genres';

describe('mapTmdbGenres', () => {
  it('maps TMDB ids and names onto catalog genres', () => {
    expect(
      mapTmdbGenres([
        { id: 28, name: 'Action' },
        { id: 878, name: 'Science Fiction' },
        { id: 10770, name: 'TV Movie' },
      ]),
    ).toEqual(['action', 'scifi', 'drama']);
  });

  it('ignores unknown genres', () => {
    expect(mapTmdbGenres([{ id: 1, name: 'Unknown' }])).toEqual([]);
  });
});
