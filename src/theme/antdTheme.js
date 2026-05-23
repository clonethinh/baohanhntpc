import { theme } from 'antd';

const tokenOverrides = {
  colorPrimary: '#1677FF',
  colorSuccess: '#52C41A',
  colorWarning: '#FAAD14',
  colorError: '#FF4D4F',
  colorInfo: '#1677FF',
  colorBgLayout: '#F5F5F5',
  colorBgContainer: '#FFFFFF',
  colorBgElevated: '#FFFFFF',
  colorBorder: '#D9D9D9',
  colorBorderSecondary: '#F0F0F0',
  borderRadius: 6,
  borderRadiusLG: 8,
  borderRadiusSM: 4,
  fontFamily: '"Segoe UI", Arial, Tahoma, "Noto Sans", "DejaVu Sans", sans-serif',
  fontSize: 14,
  motion: true,
  motionDurationMid: '0.15s',
  wireframe: false,
};

const componentOverrides = {
  Table: {
    headerBg: '#FAFAFA',
    rowHoverBg: '#E6F4FF',
    borderColor: '#F0F0F0',
    cellPaddingBlock: 10,
    cellPaddingInline: 14,
  },
  Menu: {
    itemSelectedBg: '#E6F4FF',
    itemSelectedColor: '#1677FF',
    itemHeight: 40,
  },
  Card: { paddingLG: 20 },
  Button: { primaryShadow: '0 2px 0 rgba(5,145,255,0.1)' },
  Statistic: { titleFontSize: 13, contentFontSize: 28 },
};

const darkComponentOverrides = {
  ...componentOverrides,
  Table: {
    ...componentOverrides.Table,
    headerBg: '#262626',
    rowHoverBg: '#1d2b1f',
    borderColor: '#303030',
  },
  Menu: {
    ...componentOverrides.Menu,
    itemSelectedBg: '#163b22',
    itemSelectedColor: '#7fd18a',
  },
};

export const antdLightTheme = {
  algorithm: theme.defaultAlgorithm,
  token: tokenOverrides,
  components: componentOverrides,
};

export const antdDarkTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    ...tokenOverrides,
    colorBgLayout: '#141414',
    colorBgContainer: '#1F1F1F',
    colorBgElevated: '#2A2A2A',
    colorBorder: '#303030',
    colorBorderSecondary: '#262626',
    colorText: '#E6E6E6',
    colorTextSecondary: '#A6A6A6',
  },
  components: darkComponentOverrides,
};
