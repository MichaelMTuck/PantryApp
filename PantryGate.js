import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  Button,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSession } from './Services/session';
import {
  createPantry,
  getPantries,
} from './Services/pantryService';

const PantryContext = createContext(null);

export function usePantry() {
  const context = useContext(PantryContext);

  if (!context) {
    throw new Error('usePantry must be used inside PantryGate.');
  }

  return context;
}

export default function PantryGate({ children }) {
  const { token } = useSession();

  const [pantries, setPantries] = useState([]);
  const [selectedPantry, setSelectedPantry] = useState(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function loadPantries() {
    setLoading(true);
    setError('');

    try {
      const result = await getPantries(token);
      setPantries(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPantries();
  }, [token]);

  async function handleCreate() {
    if (!name.trim()) {
      setError('Enter a pantry name.');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const pantry = await createPantry(token, name.trim());
      setPantries((current) => [...current, pantry]);
      setName('');
      setSelectedPantry(pantry);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  if (selectedPantry) {
    return (
      <PantryContext.Provider value={{ selectedPantry }}>
        <View style={{ flex: 1 }}>
          <View style={{ padding: 10 }}>
            <Text>Pantry: {selectedPantry.name}</Text>
            <Button
              title="Change pantry"
              onPress={() => setSelectedPantry(null)}
            />
          </View>

          {/* Remount screens when switching to a different pantry. */}
          <View key={selectedPantry.id} style={{ flex: 1 }}>
            {children}
          </View>
        </View>
      </PantryContext.Provider>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 24 }}>
      <Text style={{ fontSize: 24, marginBottom: 16 }}>
        Choose a pantry
      </Text>

      {loading ? <Text>Loading pantries…</Text> : null}
      {error ? <Text style={{ color: '#b00020' }}>{error}</Text> : null}

      {!loading && pantries.length === 0 && !error ? (
        <Text>You have not joined or created a pantry yet.</Text>
      ) : null}

      {pantries.map((pantry) => (
        <Button
          key={pantry.id}
          title={`${pantry.name} (${pantry.role})`}
          onPress={() => setSelectedPantry(pantry)}
        />
      ))}

      <Button
        title="Refresh pantries"
        onPress={loadPantries}
        disabled={loading || creating}
      />

      <Text style={{ marginTop: 24 }}>Create a pantry</Text>

      <TextInput
        placeholder="Pantry name"
        value={name}
        onChangeText={setName}
        maxLength={100}
        style={{ borderWidth: 1, padding: 12, marginVertical: 12 }}
      />

      <Button
        title={creating ? 'Creating…' : 'Create pantry'}
        onPress={handleCreate}
        disabled={creating}
      />
    </ScrollView>
  );
}