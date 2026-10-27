import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import * as SecureStore from 'expo-secure-store';

import { apiRequest } from './Services/api';
import { SessionContext } from './Services/session';

// Store the session token securely, never the user's password.
const TOKEN_KEY = 'pantry-session-token';

export default function AuthGate({ children }) {
  // Current authenticated session.
  const [session, setSession] = useState(null);

  // Loading an existing session when the app opens.
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState('');

  // Login and registration form fields.
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  // Request progress and feedback.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Restore a saved login and verify it with the backend.
  async function restoreSession() {
    setRestoring(true);
    setRestoreError('');

    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);

      if (token) {
        const user = await apiRequest('/me', { token });
        setSession({ token, user });
      }
    } catch (err) {
      if (err.status === 401) {
        // Remove an invalid or expired session.
        try {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          setSession(null);
        } catch {
          setRestoreError('Could not clear the expired login. Try again.');
        }
      } else {
        // Keep the saved token during temporary connection failures.
        setRestoreError(err.message);
      }
    } finally {
      setRestoring(false);
    }
  }

  useEffect(() => {
    restoreSession();
  }, []);

  // Submit either a login or registration request.
  async function submit() {
    setError('');

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    if (registering && !displayName.trim()) {
      setError('Enter a display name.');
      return;
    }

    if (registering && password.length < 12) {
      setError('Choose a password with at least 12 characters.');
      return;
    }

    setBusy(true);

    try {
      const result = await apiRequest(
        registering ? '/auth/register' : '/auth/login',
        {
          method: 'POST',
          body: {
            email: email.trim(),
            password,
            ...(registering
              ? { display_name: displayName.trim() }
              : {}),
          },
        }
      );

      try {
        await SecureStore.setItemAsync(TOKEN_KEY, result.token);
      } catch {
        // Invalidate the new session if it cannot be saved locally.
        await apiRequest('/auth/logout', {
          method: 'POST',
          token: result.token,
        }).catch(() => {});

        throw new Error('Could not securely save your login. Try again.');
      }

      setPassword('');

      setSession({
        token: result.token,
        user: result.user,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Invalidate this session and remove its saved token.
  async function logout() {
    setBusy(true);
    setError('');

    try {
      try {
        await apiRequest('/auth/logout', {
          method: 'POST',
          token: session.token,
        });
      } catch (err) {
        // An expired session is already invalid on the server.
        if (err.status !== 401) {
          throw err;
        }
      }

      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setSession(null);
      setPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Wait while checking the saved session.
  if (restoring) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Checking your login…</Text>
      </View>
    );
  }

  // Allow retrying the connection
  if (restoreError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{restoreError}</Text>
        <Button title="Try again" onPress={restoreSession} />
      </View>
    );
  }

  // Show the main app when there is a verified session.
  if (session) {
    return (
      <SessionContext.Provider
        value={{
          token: session.token,
          user: session.user,
          logout,
        }}
      >
        <View style={styles.app}>
          <View style={styles.accountBar}>
            <Text style={styles.accountName}>
              Signed in as {session.user.display_name}
            </Text>

            <Button
              title="Log out"
              onPress={logout}
              disabled={busy}
            />
          </View>

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}

          <View style={styles.app}>
            {children}
          </View>
        </View>
      </SessionContext.Provider>
    );
  }

  // Show login or registration when there is no verified session.
  return (
    <KeyboardAvoidingView
      style={styles.app}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Pantry App</Text>

        <Text style={styles.subtitle}>
          {registering ? 'Create an account' : 'Log in'}
        </Text>

        {registering ? (
          <TextInput
            style={styles.input}
            placeholder="Display name"
            accessibilityLabel="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={100}
            editable={!busy}
          />
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          accessibilityLabel="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={254}
          editable={!busy}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          accessibilityLabel="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
        />

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : null}

        <Button
          title={
            busy
              ? 'Please wait…'
              : registering
                ? 'Create account'
                : 'Log in'
          }
          onPress={submit}
          disabled={busy}
        />

        <View style={styles.switchButton}>
          <Button
            title={
              registering
                ? 'Already have an account? Log in'
                : 'Need an account? Register'
            }
            disabled={busy}
            onPress={() => {
              setRegistering(!registering);
              setError('');
              setPassword('');
            }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  form: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 20,
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#777',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    color: '#111',
  },
  error: {
    color: '#b00020',
    padding: 12,
  },
  switchButton: {
    marginTop: 16,
  },
  accountBar: {
    paddingTop: 55,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  accountName: {
    flex: 1,
  },
});