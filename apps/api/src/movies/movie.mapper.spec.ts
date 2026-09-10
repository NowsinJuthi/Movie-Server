import { MediaAssetStatus, MediaKind, VideoResolution } from '@movie-server/shared';
import { toAdminMediaAsset, toPublicMediaAsset } from './movie.mapper';
import { MediaAssetDocument } from './schemas/media-asset.schema';

describe('movie.mapper', () => {
  const asset = {
    _id: { toString: () => 'asset1' },
    movieId: { toString: () => 'movie1' },
    kind: MediaKind.Video,
    storageKey: 'abc123',
    storagePath: 'C:\\data\\movies\\film.mkv',
    quality: VideoResolution.Uhd4k,
    language: 'en',
    label: '4K',
    codec: 'hevc',
    channels: null,
    bitrateKbps: 20000,
    forced: false,
    hearingImpaired: false,
    isDefault: true,
    sortOrder: 0,
    status: MediaAssetStatus.Ready,
  } as unknown as MediaAssetDocument;

  it('never copies storage paths into public or admin payloads', () => {
    const pub = toPublicMediaAsset(asset, null, true);
    const admin = toAdminMediaAsset(asset);
    expect(JSON.stringify(pub)).not.toMatch(/C:\\|\/var\/|storage\//);
    expect(JSON.stringify(admin)).not.toMatch(/C:\\|\/var\/|storage\//);
    expect(admin).not.toHaveProperty('storagePath');
    expect(pub).not.toHaveProperty('storageKey');
    expect(pub).not.toHaveProperty('storagePath');
  });
});
