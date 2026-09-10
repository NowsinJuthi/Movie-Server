import { localArtworkKeys } from './local-artwork';

describe('localArtworkKeys', () => {
  it('looks for Emby-style posters next to the video', () => {
    const keys = localArtworkKeys('Extraction 2 (2023).mp4');
    expect(keys.posters).toEqual(
      expect.arrayContaining(['poster.jpg', 'folder.jpg', 'Extraction 2 (2023).jpg']),
    );
    expect(keys.backdrops).toEqual(expect.arrayContaining(['fanart.jpg', 'backdrop.jpg']));
    expect(keys.posters).not.toContain('Extraction 2 (2023).mp4');
  });

  it('keeps artwork relative to a movie folder', () => {
    const keys = localArtworkKeys('Extraction 2 (2023)/videofile.mkv');
    expect(keys.posters).toEqual(expect.arrayContaining(['Extraction 2 (2023)/poster.jpg']));
  });
});
