import i18n from '../i18n/index.js';

export function tStatus(key) {
  return i18n.t(`status:${key}`);
}

export function makeWarrantyOptions() {
  return {
    baoHanhOptions: [
      { label: i18n.t('status:baoHanh.motThang'), value: '1 tháng' },
      { label: i18n.t('status:baoHanh.baThang'), value: '3 tháng' },
      { label: i18n.t('status:baoHanh.muoiHaiThang'), value: '12 tháng' },
      { label: i18n.t('status:baoHanh.haiMuoiBonThang'), value: '24 tháng' },
      { label: i18n.t('status:baoHanh.baMuoiSauThang'), value: '36 tháng' },
      { label: i18n.t('status:baoHanh.sauMuoiThang'), value: '60 tháng' },
      { label: i18n.t('status:baoHanh.khac'), value: 'khac' },
    ],
    loaiXuLyOptions: ['bao_hanh', 'sua_dv', 'doi_moi', 'khac'].map((value) => ({
      label: i18n.t(`status:loaiXuLy.${value}`),
      value,
    })),
  };
}
