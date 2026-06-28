import { describe, expect, it, vi, afterEach } from 'vitest';
import { parseHeaders, main } from '../cli.js';

describe('parseHeaders', () => {
  it('parses repeated "Key: Value" header strings', () => {
    expect(parseHeaders(['Authorization: Bearer abc', 'X-Tenant: acme'])).toEqual({
      Authorization: 'Bearer abc',
      'X-Tenant': 'acme',
    });
  });

  it('trims whitespace and tolerates colons in the value', () => {
    expect(parseHeaders(['X-Url:  https://a.example/x  '])).toEqual({
      'X-Url': 'https://a.example/x',
    });
  });

  it('ignores malformed entries and an undefined list', () => {
    expect(parseHeaders(['no-colon', ': empty-key'])).toEqual({});
    expect(parseHeaders(undefined)).toEqual({});
  });
});

describe('main', () => {
  const originalExitCode = process.exitCode;
  afterEach(() => {
    process.exitCode = originalExitCode;
  });

  it('errors and sets a failing exit code when no source is provided', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await main([]);

    expect(process.exitCode).toBe(1);
    expect(write).toHaveBeenCalled();
    write.mockRestore();
  });

  it('prints help without failing when --help is passed', async () => {
    process.exitCode = 0;
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await main(['--help']);

    expect(process.exitCode).toBe(0);
    expect(write).toHaveBeenCalled();
    write.mockRestore();
  });
});
