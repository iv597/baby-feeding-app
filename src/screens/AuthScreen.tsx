import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Text, TextInput, SegmentedButtons, HelperText, Card } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';

type AuthMode = 'signin' | 'signup' | 'reset';

export default function AuthScreen() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setMessage({ text: 'Email is required', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      let result;
      
      switch (mode) {
        case 'signin':
          if (!password.trim()) {
            setMessage({ text: 'Password is required', type: 'error' });
            return;
          }
          result = await signIn(email.trim(), password);
          break;
        case 'signup':
          if (!password.trim()) {
            setMessage({ text: 'Password is required', type: 'error' });
            return;
          }
          if (!fullName.trim()) {
            setMessage({ text: 'Full name is required', type: 'error' });
            return;
          }
          result = await signUp(email.trim(), password, fullName.trim());
          break;
        case 'reset':
          result = await resetPassword(email.trim());
          break;
      }

      if (result?.error) {
        setMessage({ text: result.error.message || 'An error occurred', type: 'error' });
      } else if (mode === 'reset') {
        setMessage({ text: 'Password reset email sent!', type: 'success' });
      }
    } catch (error: any) {
      setMessage({ text: error.message || 'An error occurred', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
    switch (mode) {
      case 'signin':
        return (
          <View>
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
            />
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              Sign In
            </Button>
          </View>
        );
      case 'signup':
        return (
          <View>
            <TextInput
              label="Full Name"
              value={fullName}
              onChangeText={setFullName}
              style={styles.input}
            />
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
            />
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              Sign Up
            </Button>
          </View>
        );
      case 'reset':
        return (
          <View>
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              Send Reset Email
            </Button>
          </View>
        );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineMedium" style={styles.title}>
            Baby Feed Tracker
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Track your baby's feeding journey
          </Text>

          <SegmentedButtons
            value={mode}
            onValueChange={(value) => setMode(value as AuthMode)}
            buttons={[
              { label: 'Sign In', value: 'signin' },
              { label: 'Sign Up', value: 'signup' },
              { label: 'Reset', value: 'reset' },
            ]}
            style={styles.segmentedButtons}
          />

          {renderForm()}

          {message && (
            <HelperText type={message.type === 'success' ? 'info' : 'error'} visible>
              {message.text}
            </HelperText>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    justifyContent: 'center',
  },
  card: {
    padding: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  segmentedButtons: {
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
});