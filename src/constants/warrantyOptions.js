import i18n from '../i18n/index.js';

export const BAO_HANH_OPTIONS = [
  { label: i18n.t('status:baoHanh.motThang'), value: '1 tháng' },
  { label: i18n.t('status:baoHanh.baThang'), value: '3 tháng' },
  { label: i18n.t('status:baoHanh.muoiHaiThang'), value: '12 tháng' },
  { label: i18n.t('status:baoHanh.haiMuoiBonThang'), value: '24 tháng' },
  { label: i18n.t('status:baoHanh.baMuoiSauThang'), value: '36 tháng' },
  { label: i18n.t('status:baoHanh.sauMuoiThang'), value: '60 tháng' },
  { label: i18n.t('status:baoHanh.khac'), value: 'khac' },
];

export const LOAI_XU_LY_OPTIONS = ['bao_hanh', 'sua_dv', 'doi_hang', 'khac'].map((value) => ({
  label: i18n.t(`status:loaiXuLy.${value}`),
  value,
}));

export const LOAI_XU_LY_LABELS = {
  bao_hanh: i18n.t('status:loaiXuLy.bao_hanh'),
  sua_dv: i18n.t('status:loaiXuLy.sua_dv'),
  doi_hang: i18n.t('status:loaiXuLy.doi_hang'),
  khac: i18n.t('status:loaiXuLy.khac'),
};
