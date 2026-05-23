import dayjs from 'dayjs';

export function generateChungTuPreview(existingCodes = []) {
  const today = dayjs().format('DDMMYYYY');
  const todayCodes = existingCodes.filter(c => c.startsWith(today));
  const n = todayCodes.length + 1;
  return `${today}NBHSC${n}`;
}
