import React from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import AuthScreen from './src/screens/AuthScreen';
import { getPaperTheme } from './src/theme';

function InnerApp() {
  const { user, loading } = useAuth();
  const theme = getPaperTheme('light'); // Default theme for auth screen

  if (loading) {
    // Show loading state
    return (
      <PaperProvider theme={theme}>
        <StatusBar style="dark" />
        {/* You can add a proper loading screen here */}
      </PaperProvider>
    );
  }

  if (!user) {
    // Show auth screen
    return (
      <PaperProvider theme={theme}>
        <StatusBar style="dark" />
        <AuthScreen />
      </PaperProvider>
    );
  }

  // Show main app
  return <RootNavigator />;
}

export default function App() {
  return (
    <AuthProvider>
      <InnerApp />
    </AuthProvider>
  );
}
