import uiVi from '../i18n/locales/vi/ui.json' with { type: 'json' };

const FIELD_LABELS = uiVi.field || {};

export function getFieldLabel(field, fallback = field) {
  if (!field) return fallback;
  return FIELD_LABELS[field] || fallback;
}

export function getFieldLabels(fields = []) {
  return fields.reduce((labels, field) => {
    labels[field] = getFieldLabel(field);
    return labels;
  }, {});
}
