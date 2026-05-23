import { describe, it, expect } from 'vitest';
import { generateChungTuPreview } from '../src/utils/generateChungTu';
import dayjs from 'dayjs';

describe('generateChungTuPreview', () => {
  it('generates correct format for today', () => {
    const today = dayjs().format('DDMMYYYY');
    const code = generateChungTuPreview([]);
    expect(code).toMatch(new RegExp(`^${today}NTPC1$`));
  });

  it('increments N when existing codes present', () => {
    const today = dayjs().format('DDMMYYYY');
    const existing = [`${today}NTPC1`, `${today}NTPC2`];
    const code = generateChungTuPreview(existing);
    expect(code).toBe(`${today}NTPC3`);
  });

  it('ignores codes from other days', () => {
    const today = dayjs().format('DDMMYYYY');
    const yesterday = dayjs().subtract(1, 'day').format('DDMMYYYY');
    const existing = [`${yesterday}NTPC1`, `${yesterday}NTPC2`];
    const code = generateChungTuPreview(existing);
    expect(code).toBe(`${today}NTPC1`);
  });
});
