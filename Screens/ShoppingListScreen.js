import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS } from "../data/theme";
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {saving ? <Text style={styles.mutedText}>Saving…</Text> : null}

      {/* Add item form */}
      <Text style={styles.sectionTitle}>Add to shopping list</Text>
      <View style={styles.addContainer}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Item name"
          placeholderTextColor={COLORS.placeholder}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Quantity</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Quantity"
          placeholderTextColor={COLORS.placeholder}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Unit</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Unit"
          placeholderTextColor={COLORS.placeholder}
          value={unit}
          onChangeText={setUnit}
        />

        <Pressable
          disabled={busy}
          onPress={() => save(async () => {
            const added = await addShoppingItem(token, pantryId, {
              name, quantity: Number(quantity), unit,
            });
            setItems((current) => [...current, added]);
            setName("");
            setQuantity("1");
          })}
          style={({ pressed }) => [
            styles.submitButton,
            busy && styles.submitButtonDisabled,
            pressed && styles.submitButtonPressed,
          ]}
        >
          <Text style={styles.submitButtonText}>
            {saving ? "Saving…" : "Add to shopping list"}
          </Text>
        </Pressable>
      </View>

      {/* List */}
      <Text style={styles.sectionTitle}>Your list</Text>
      {loading ? <Text style={styles.mutedText}>Loading shopping list…</Text> : null}
      {!loading && items.length === 0 ? (
        <Text style={styles.mutedText}>Your shopping list is empty.</Text>
      ) : null}

      {items.map((item) => (
        <View key={item.id} style={styles.itemCard}>
          <View style={styles.itemInfo}>
            <Text style={[styles.itemName, item.checked && styles.itemTextChecked]}>
              {item.checked ? "✓ " : ""}{item.name}
            </Text>
            <Text style={[styles.itemQuantity, item.checked && styles.itemTextChecked]}>
              {item.quantity} {item.unit}
            </Text>
          </View>

          <View style={styles.itemActions}>
            <Pressable
              disabled={busy}
              onPress={() => save(async () => {
                const updated = await setShoppingItemChecked(
                  token, pantryId, item.id, !item.checked
                );
                setItems((current) => current.map((row) =>
                  row.id === item.id ? { ...row, ...updated } : row
                ));
              })}
              style={({ pressed }) => [
                styles.checkButton,
                busy && styles.submitButtonDisabled,
                pressed && styles.checkButtonPressed,
              ]}
            >
              <Text style={styles.checkButtonText}>
                {item.checked ? "Uncheck" : "Check off"}
              </Text>
            </Pressable>

            <Pressable
              disabled={busy}
              hitSlop={12}
              onPress={() => save(async () => {
                await deleteShoppingItem(token, pantryId, item.id);
                setItems((current) => current.filter((row) => row.id !== item.id));
              })}
            >
              <Text style={[styles.removeText, busy && styles.submitButtonDisabled]}>
                Remove
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 10,
    paddingBottom: 32,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 6,
    marginLeft: 4,
    color: COLORS.greenDark,
  },

  // Add form
  addContainer: {
    marginLeft: 4,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 3,
    color: COLORS.text,
  },
  textInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 6,
  },
  submitButton: {
    backgroundColor: COLORS.green,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 6,
  },
  submitButtonPressed: {
    backgroundColor: COLORS.greenDark,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },

  // List items
  itemCard: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    flexDirection: "row",
    alignItems: "center",
  },
  itemInfo: {
    flex: 1,
    paddingRight: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  itemQuantity: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  itemTextChecked: {
    color: COLORS.textMuted,
    textDecorationLine: "line-through",
  },
  itemActions: {
    alignItems: "center",
    gap: 10,
  },
  checkButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 96,
    alignItems: "center",
  },
  checkButtonPressed: {
    backgroundColor: COLORS.blueDark,
  },
  checkButtonText: {
    color: COLORS.blueText,
    fontSize: 15,
    fontWeight: "600",
  },
  removeText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.red,
  },

  errorText: {
    color: COLORS.red,
    marginBottom: 4,
  },
  mutedText: {
    color: COLORS.textMuted,
    marginLeft: 4,
  },
});
