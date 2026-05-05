import type { ThemeConfig } from 'antd';
import { theme as antdTheme } from 'antd';

export const designTokens = {
  primary: '#2563EB',
  primaryHover: '#0a36ad',
  accent: '#FACC15',
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#FACC15',
  info: '#2563EB',
  light: {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    text: '#0F172A',
    secondaryText: '#475569',
    border: '#E2E8F0',
    disabled: '#94A3B8'
  },
  dark: {
    bg: '#020617',
    card: '#0F172A',
    text: '#F1F5F9',
    secondaryText: '#94A3B8',
    border: '#1E293B',
    primary: '#3B82F6',
    primaryHover: '#60A5FA'
  }
} as const;

export const getAntdTheme = (mode: 'light' | 'dark'): ThemeConfig => ({
  algorithm:
    mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: {
    colorPrimary:
      mode === 'dark' ? designTokens.dark.primary : designTokens.primary,
    colorLink:
      mode === 'dark' ? designTokens.dark.primary : designTokens.primary,
    colorInfo: mode === 'dark' ? designTokens.dark.primary : designTokens.info,
    colorSuccess: designTokens.success,
    colorError: designTokens.danger,
    colorWarning: designTokens.warning,
    colorBgBase: mode === 'dark' ? designTokens.dark.bg : designTokens.light.bg,
    colorTextBase:
      mode === 'dark' ? designTokens.dark.text : designTokens.light.text,
    colorBorder:
      mode === 'dark' ? designTokens.dark.border : designTokens.light.border,
    colorBorderSecondary:
      mode === 'dark' ? '#1E293B' : '#F1F5F9',
    colorSplit:
      mode === 'dark' ? '#1E293B' : '#E2E8F0',
    borderRadius: 10,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 14,
    controlHeight: 40,
    colorBgContainer: mode === 'dark' ? '#141414' : '#FFFFFF',
  },
  components: {
    Button: {
      borderRadius: 10,
      controlHeight: 40,
      primaryShadow: '0 2px 8px rgba(37,99,235,0.25)',
      defaultBorderColor: mode === 'dark' ? '#334155' : '#D1D5DB',
    },
    Input: {
      borderRadius: 10,
      controlHeight: 40,
      colorBorder: mode === 'dark' ? '#334155' : '#D1D5DB',
      hoverBorderColor: mode === 'dark' ? '#475569' : '#93C5FD',
      activeBorderColor: mode === 'dark' ? designTokens.dark.primary : designTokens.primary,
    },
    Card: {
      borderRadiusLG: 16,
      paddingLG: 24,
      colorBorderSecondary: mode === 'dark' ? '#1E293B' : '#E2E8F0',
    },
    Select: {
      borderRadius: 10,
      controlHeight: 40,
      colorBorder: mode === 'dark' ? '#334155' : '#D1D5DB',
      hoverBorderColor: mode === 'dark' ? '#475569' : '#93C5FD',
      activeBorderColor: mode === 'dark' ? designTokens.dark.primary : designTokens.primary,
    },
    Tabs: {
      itemSelectedColor: mode === 'dark' ? '#60A5FA' : '#2563EB',
      inkBarColor: mode === 'dark' ? '#60A5FA' : '#2563EB',
    },
    Tag: {
      borderRadiusSM: 6,
    },
    Divider: {
      colorSplit: mode === 'dark' ? '#1E293B' : '#E2E8F0',
    },
    Modal: {
      contentBg: mode === 'dark' ? '#1a1a1a' : '#FFFFFF',
      headerBg: mode === 'dark' ? '#1a1a1a' : '#FFFFFF',
      footerBg: mode === 'dark' ? '#1a1a1a' : '#FFFFFF',
      titleColor: mode === 'dark' ? '#F1F5F9' : '#0F172A',
      colorIcon: mode === 'dark' ? '#94A3B8' : '#64748B',
      colorIconHover: mode === 'dark' ? '#F1F5F9' : '#0F172A',
    },
    Popconfirm: {
      colorTextHeading: mode === 'dark' ? '#F1F5F9' : '#0F172A',
    },
  },
});
