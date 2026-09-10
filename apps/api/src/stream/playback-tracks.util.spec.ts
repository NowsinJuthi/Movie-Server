import { pickStoredTrack, preferredSubtitleCode, toPlaybackTrack } from './playback-tracks.util';
import { StoredPlaybackTrack } from './playback-session.types';

function track(partial: Partial<StoredPlaybackTrack> & Pick<StoredPlaybackTrack, 'assetId' | 'kind'>): StoredPlaybackTrack {
  return {
    language: null,
    label: null,
    codec: null,
    channels: null,
    format: null,
    forced: false,
    hearingImpaired: false,
    isDefault: false,
    playable: false,
    embedded: false,
    streamIndex: null,
    ...partial,
  };
}

describe('playback-tracks.util', () => {
  const hindi = track({
    assetId: 'hi',
    kind: 'audio',
    language: 'hi',
    codec: 'aac',
    channels: 2,
    playable: true,
  });
  const englishEmbedded = track({
    assetId: 'en-emb',
    kind: 'audio',
    language: 'eng',
    codec: 'aac',
    isDefault: true,
    playable: false,
    embedded: true,
    streamIndex: 0,
  });
  const bangla = track({
    assetId: 'bn',
    kind: 'subtitle',
    language: 'bn',
    format: 'vtt',
    playable: true,
  });
  const ass = track({
    assetId: 'es',
    kind: 'subtitle',
    language: 'es',
    format: 'ass',
    playable: false,
  });

  it('prefers a playable track matching the profile language', () => {
    expect(pickStoredTrack([englishEmbedded, hindi], 'hi')?.assetId).toBe('hi');
    expect(pickStoredTrack([ass, bangla], 'bn')?.assetId).toBe('bn');
  });

  it('matches ISO aliases such as eng → English', () => {
    expect(pickStoredTrack([englishEmbedded], 'en')?.assetId).toBe('en-emb');
  });

  it('returns no subtitle when the preference is off', () => {
    expect(preferredSubtitleCode('off')).toBeNull();
    expect(pickStoredTrack([bangla, ass], preferredSubtitleCode('off'), true)).toBeNull();
  });

  it('marks embedded dual-audio as playable without a sidecar URL', () => {
    const embedded = toPlaybackTrack('sess', englishEmbedded);
    expect(embedded.playable).toBe(true);
    expect(embedded.embedded).toBe(true);
    expect(embedded.streamIndex).toBe(0);
    expect(embedded.url).toBeNull();
  });

  it('exposes stream URLs for alternate embedded audio tracks', () => {
    const second = track({
      assetId: 'en-2',
      kind: 'audio',
      language: 'eng',
      embedded: true,
      streamIndex: 1,
      playable: false,
    });
    const mapped = toPlaybackTrack('sess', second);
    expect(mapped.playable).toBe(true);
    expect(mapped.url).toContain('/audio/en-2');
  });

  it('omits stream URLs for unplayable tracks', () => {
    const playable = toPlaybackTrack('sess', hindi);
    const blocked = toPlaybackTrack('sess', ass);
    expect(playable.url).toContain('/audio/hi');
    expect(playable.languageLabel).toBe('Hindi');
    expect(blocked.playable).toBe(false);
    expect(blocked.url).toBeNull();
  });
});
