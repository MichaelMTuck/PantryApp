// Displays all the ingredients currently stored in the pantry
import { useEffect, useState } from "react";
import { View, Text, TextInput, FlatList, Button, Modal, StyleSheet } from "react-native";
import { UNITS } from "../data/units";
import PantryItem from "../Components/PantryItem";
import { useSession } from "../Services/session";
import { usePantry } from "../PantryGate";

import {
  getPantryItems,
  addPantryItem,
  updatePantryItem,
} from "../Services/pantryService";

const UNIT_NAMES = Object.keys(UNITS);

export default function Pantry() {
  const { token } = useSession();
  const { selectedPantry } = usePantry();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    setLoading(true);
    setItems([]);
    setError('');

    getPantryItems(token, selectedPantry.id)
      .then((result) => {
        if (active) setItems(result);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, selectedPantry.id]);

  async function refreshItems() {
    setLoading(true);
    setError('');

    try {
      const result = await getPantryItems(token, selectedPantry.id);
      setItems(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  const [searchText, setSearchText] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState(UNIT_NAMES[0]);
  const [showUnits, setShowUnits] = useState(false);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const addItem = async () => {
    if (saving || loading) return;

    const amount = Number(quantity);

    if (
      !name.trim() ||
      !quantity.trim() ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      setError('Enter a name and a valid nonnegative quantity.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const savedItem = await addPantryItem(token, selectedPantry.id, {
        name: name.trim(),
        quantity: amount,
        unit,
        expiration_date: null,
      });

      setItems((current) => [savedItem, ...current]);

      setName('');
      setQuantity('');
      setUnit(UNIT_NAMES[0]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Change one item's quantity, never below 0
  // Save quantity changes to PostgreSQL, never below 0.
const updateQuantity = async (id, newQuantity) => {
  if (saving || loading) return;

  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  setSaving(true);
  setError('');

  try {
    const savedItem = await updatePantryItem(
      token,
      selectedPantry.id,
      id,
      {
        name: item.name,
        quantity: Math.max(0, newQuantity),
        unit: item.unit,

        // PUT replaces editable fields, so preserve these values.
        expiration_date: item.expiration_date,
        purchased_on: item.purchased_on,
        total_cost: item.total_cost === null
          ? null
          : Number(item.total_cost),
      }
    );

    setItems((current) =>
      current.map((entry) => entry.id === id ? savedItem : entry)
    );
  } catch (err) {
    setError(err.message);
  } finally {
    setSaving(false);
  }
};

  return (
  <View style={styles.container}>
    {error ? (
      <Text style={{ color: '#b00020' }}>{error}</Text>
    ) : null}

    {saving ? <Text>Saving…</Text> : null}

    <Text>Search</Text>

    {/* Keep your existing search input, list, and form below. */}
      
      <Text>Search</Text>
      <TextInput
        placeholder="Search pantry items..."
        value={searchText}
        onChangeText={setSearchText}
      />

      <FlatList
  data={filteredItems}
  renderItem={({ item }) => (
    <PantryItem
      {...item}
      onChangeQuantity={(q) => updateQuantity(item.id, q)}
    />
  )}
  keyExtractor={item => item.id.toString()}
  refreshing={loading}
  onRefresh={refreshItems}
  ListEmptyComponent={
    <Text>
      {loading ? 'Loading…' : 'No matching pantry items.'}
    </Text>
  }
/>

      <Text>Add a new item</Text>
      <TextInput placeholder="Name" value={name} onChangeText={setName} />
      <TextInput placeholder="Quantity" value={quantity} onChangeText={setQuantity} />

      {/* Button shows current unit and tapping it opens the list */}
      <Button title={`Unit: ${unit}`} onPress={() => setShowUnits(true)} />
      <Modal visible={showUnits} animationType="slide">
        <View style={styles.container}>
          {UNIT_NAMES.map(u => (
            <Button
              key={u}
              title={u}
              onPress={() => {
                setUnit(u);
                setShowUnits(false);
              }}
            />
          ))}
        </View>
      </Modal>

      <Button
  title={saving ? "Saving…" : "Add item"}
  onPress={addItem}
  disabled={saving || loading}
/>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: "#f5f5f5" },
});
