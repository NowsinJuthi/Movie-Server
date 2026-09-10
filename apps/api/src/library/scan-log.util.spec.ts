import { sanitizeScanMessage } from './scan-log.util';

describe('sanitizeScanMessage', () => {
  it('redacts absolute filesystem roots and windows paths', () => {
    const message = sanitizeScanMessage(
      'Failed C:\\Movies\\film.mkv and /var/media/show.mkv inside D:\\data\\libraries',
      ['D:\\data\\libraries'],
    );
    expect(message).not.toMatch(/C:\\/);
    expect(message).not.toMatch(/\/var\//);
    expect(message).not.toContain('D:\\data\\libraries');
    expect(message).toContain('[path]');
    expect(message).toContain('[library]');
  });
});
