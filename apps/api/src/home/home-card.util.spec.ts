import { movieToHomeCard, genreDisplayName } from './home-card.util';
import { MaturityLevel, MovieAvailability, type PublicMovie } from '@movie-server/shared';

describe('home-card.util', () => {
  it('labels sci-fi and builds movie cards without storage paths', () => {
    expect(genreDisplayName('scifi')).toBe('Sci-Fi');
    expect(genreDisplayName('drama')).toBe('Drama');
    const movie = {
      id: 'm1',
      slug: 'nebula-dawn',
      title: 'Nebula Dawn',
      originalTitle: null,
      description: 'A fleet is lost.',
      posterUrl: '/api/v1/media/artwork/abc.jpg',
      backdropUrl: 'https://example.com/back.jpg',
      trailerUrl: null,
      releaseYear: 2026,
      runtimeMinutes: 120,
      genres: ['scifi'],
      tags: [],
      cast: [],
      directors: [],
      writers: [],
      ratings: { imdb: 8.1, tmdb: null, critics: null, audience: null },
      maturityRating: MaturityLevel.Mature,
      certification: 'PG-13',
      collectionId: null,
      featured: true,
      trending: true,
      popular: false,
      published: true,
      availability: MovieAvailability.Available,
      playable: true,
      maxResolution: '4k',
      markers: {
        introStartSeconds: null,
        introEndSeconds: null,
        recapStartSeconds: null,
        recapEndSeconds: null,
        creditsStartSeconds: null,
      },
    } as PublicMovie;
    const card = movieToHomeCard(movie, new Set(['m1']));
    expect(card.inMyList).toBe(true);
    expect(card.badges).toEqual(expect.arrayContaining(['New', '4K', 'Trending']));
    expect(card.href).toBe('/home/movies/m1');
    expect(JSON.stringify(card)).not.toMatch(/C:\\|\/var\/|storage\/uploads/i);
  });
});
