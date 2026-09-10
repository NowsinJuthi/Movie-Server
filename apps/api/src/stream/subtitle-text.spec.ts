import { srtToWebVtt, toSafeWebVtt } from './subtitle-text';

describe('subtitle-text', () => {
  it('converts SRT to WebVTT and strips unsafe markup', () => {
    const vtt = srtToWebVtt(`1
00:00:01,000 --> 00:00:03,000
Hello <b>English</b>

2
00:00:04,000 --> 00:00:06,000
<script>alert(1)</script>Safe`);
    expect(vtt.startsWith('WEBVTT')).toBe(true);
    expect(vtt).toContain('00:00:01.000 --> 00:00:03.000');
    expect(vtt).toContain('<b>English</b>');
    expect(vtt).toContain('Safe');
    expect(vtt).not.toContain('<script>');
  });

  it('sanitizes existing WebVTT', () => {
    const vtt = toSafeWebVtt(
      `WEBVTT

00:00:01.000 --> 00:00:02.000
<img src=x onerror=alert(1)>Bangla`,
      'vtt',
    );
    expect(vtt).toContain('Bangla');
    expect(vtt).not.toContain('onerror');
    expect(vtt).not.toContain('<img');
  });
});
