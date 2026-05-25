import { describe, it, expect } from 'vitest';
import { generateChungTuPreview } from '../src/utils/generateChungTu';
import dayjs from 'dayjs';

describe('generateChungTuPreview', () => {
  it('generates correct format for today', () => {
    const today = dayjs().format('DDMMYYYY');
    const code = generateChungTuPreview([]);
    expect(code).toMatch(new RegExp(`^${today}NBHSC1$`));
  });

  it('increments N when existing codes present', () => {
    const today = dayjs().format('DDMMYYYY');
    const existing = [`${today}NBHSC1`, `${today}NBHSC2`];
    const code = generateChungTuPreview(existing);
    expect(code).toBe(`${today}NBHSC3`);
  });

  it('ignores codes from other days', () => {
    const today = dayjs().format('DDMMYYYY');
    const yesterday = dayjs().subtract(1, 'day').format('DDMMYYYY');
    const existing = [`${yesterday}NBHSC1`, `${yesterday}NBHSC2`];
    const code = generateChungTuPreview(existing);
    expect(code).toBe(`${today}NBHSC1`);
  });
});
