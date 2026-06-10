export function buildEmptyData() {
  return { rows: [], total: 0, page: 1, limit: 10 };
}

export function buildDefaultForm() {
  return {
    title: '',
    content: '',
    displayType: 'banner',
    priority: 0,
    isActive: true,
    scheduleType: 'manual',
    startAt: null,
    endAt: null,
  };
}
