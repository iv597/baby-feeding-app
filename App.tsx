import React, { useEffect } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import { getPaperTheme } from './src/theme';
import { AppProvider, useAppContext } from './src/context/AppContext';

function InnerApp() {
  const { themeMode } = useAppContext();
  const theme = getPaperTheme(themeMode);
  return (
    <PaperProvider theme={theme}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
    </PaperProvider>
  );
}

export default function App() {
  return (
    <AppProvider>
      <InnerApp />
    </AppProvider>
  );
}
