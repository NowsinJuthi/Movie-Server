import { generateOpaqueToken, hashToken, tokensMatch } from './tokens';

describe('token helpers', () => {
  it('hashes and compares opaque tokens without exposing the raw value', () => {
    const token = generateOpaqueToken();
    const digest = hashToken(token);
    expect(digest).toHaveLength(64);
    expect(digest).not.toEqual(token);
    expect(tokensMatch(token, digest)).toBe(true);
    expect(tokensMatch('other-token-value-here', digest)).toBe(false);
  });
});
