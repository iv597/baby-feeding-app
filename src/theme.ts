import { MD3DarkTheme, MD3LightTheme, configureFonts, MD3Theme } from 'react-native-paper';

const fontConfig = {
  config: {
    fontFamily: 'System',
  },
};

export function getPaperTheme(mode: 'light' | 'dark'): MD3Theme {
  const base = mode === 'dark' ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    fonts: configureFonts({ config: fontConfig.config }),
    colors: {
      ...base.colors,
      primary: '#7C83FD',
      secondary: '#96BAFF',
      tertiary: '#7DEDFF',
      surface: mode === 'dark' ? '#1C1C23' : '#FFFFFF',
      background: mode === 'dark' ? '#121219' : '#F6F7FB',
      onSurface: mode === 'dark' ? '#EDEDF2' : '#1D1E2C',
      outline: mode === 'dark' ? '#2E2F3A' : '#E0E3EB',
    },
    roundness: 14,
  } as MD3Theme;
}