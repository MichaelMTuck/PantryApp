import { useCallback, useEffect, useState } from "react";
import { Button, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { usePantry } from "../PantryGate";
import { useSession } from "../Services/session";
import {
  addShoppingItem,
  deleteShoppingItem,
  getShoppingItems,
  setShoppingItemChecked,
} from "../Services/shoppingService";

export default function ShoppingListScreen({ route }) {
  const { token } = useSession();
  const { selectedPantry } = usePantry();
  const pantryId = selectedPantry.id;
  const draft = route.params?.draft;

  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("items");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!draft || draft.pantryId !== pantryId) return;
    setName(draft.name);
    setQuantity("1");
    setUnit(draft.unit);
  }, [draft, pantryId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError("");

    getShoppingItems(token, pantryId)
      .then((rows) => { if (active) setItems(rows); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [token, pantryId]));

  async function save(action) {
    if (loading || saving) return;
    setSaving(true);
    setError("");

    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const busy = loading || saving;
  const inputStyle = { borderWidth: 1, padding: 10, marginBottom: 8 };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <TextInput style={inputStyle} placeholder="Item name" value={name} onChangeText={setName} />
      <TextInput style={inputStyle} placeholder="Quantity" value={quantity}
        onChangeText={setQuantity} keyboardType="decimal-pad" />
      <TextInput style={inputStyle} placeholder="Unit" value={unit} onChangeText={setUnit} />

      <Button title="Add to shopping list" disabled={busy} onPress={() => save(async () => {
        const added = await addShoppingItem(token, pantryId, {
          name, quantity: Number(quantity), unit,
        });
        setItems((current) => [...current, added]);
        setName("");
        setQuantity("1");
      })} />

      {loading ? <Text>Loading shopping list…</Text> : null}
      {error ? <Text style={{ color: "#b00020" }}>{error}</Text> : null}

      {items.map((item) => (
        <View key={item.id} style={{ paddingVertical: 10 }}>
          <Text>
            {item.checked ? "✓ " : ""}{item.name} · {item.quantity} {item.unit}
          </Text>
          <Button title={item.checked ? "Uncheck" : "Check off"} disabled={busy}
            onPress={() => save(async () => {
              const updated = await setShoppingItemChecked(
                token, pantryId, item.id, !item.checked
              );
              setItems((current) => current.map((row) =>
                row.id === item.id ? { ...row, ...updated } : row
              ));
            })} />
          <Button title="Remove" disabled={busy} onPress={() => save(async () => {
            await deleteShoppingItem(token, pantryId, item.id);
            setItems((current) => current.filter((row) => row.id !== item.id));
          })} />
        </View>
      ))}
    </ScrollView>
  );
}