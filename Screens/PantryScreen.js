// Displays all the ingredients currently stored in the pantry
import { useEffect, useState, useRef } from "react";
import { Alert, View, Text, TextInput, FlatList, Button, Modal, StyleSheet, Pressable, KeyboardAvoidingView, Platform} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { UNITS } from "../data/units";
import { COLORS } from "../data/theme";
import PantryItem from "../Components/PantryItem";
import { useSession } from "../Services/session";
import { usePantry } from "../PantryGate";

import {
  getPantryItems,
  addPantryItem,
  updatePantryItem,
  adjustPantryQuantity,
} from "../Services/pantryService";

const UNIT_NAMES = Object.keys(UNITS);


// Formats as YYYY-MM-DD
const formatDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Turns a YYYY-MM-DD string back into a Date so picker can show it
const parseDate = (str) => {
  if (!str) return new Date();
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export default function Pantry() {
  const { token } = useSession();
  const { selectedPantry } = usePantry();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [hideEmpty, setHideEmpty] = useState(false);
  const quantityRequestRunning = useRef(false);

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
    if (saving || loading) return;
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
  const [totalCost, setTotalCost] = useState("");
  const [unit, setUnit] = useState(UNIT_NAMES[0]);
  const [showUnits, setShowUnits] = useState(false);

  // Optional expiration date (empty string = no date)
  const [expirationDate, setExpirationDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Called whenever user picks a date in the calendar
  const onDateChange = (event, selected) => {
    if (selected) setExpirationDate(formatDate(selected));
  };

  const filteredItems = items.filter(item =>
    {
      const matchesSearch = item.name.toLowerCase().includes(searchText.toLowerCase());
      // When hideEmpty is true
      const hasStock = !hideEmpty || Number(item.quantity) > 0;

      return matchesSearch && hasStock;
    }
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

    const priceText = totalCost.trim();
    const price = priceText === "" ? null : Number(priceText);

    if (
      price !== null &&
      (!Number.isFinite(price) || price < 0 || price > 1000000000 || amount <= 0)
    ) {
      setError("Enter a valid nonnegative purchase price and a positive quantity.");
      return;
    }

    setSaving(true);
    setError('');

    try {
      const savedItem = await addPantryItem(token, selectedPantry.id, {
        name: name.trim(),
        quantity: amount,
        unit,
        // YYYY-MM-DD string or null when no date is picked
        expiration_date: expirationDate || null,
        total_cost: price,
      });

      setItems((current) => [savedItem, ...current]);

      setName('');
      setQuantity('');
      setTotalCost('');
      setUnit(UNIT_NAMES[0]);
      setExpirationDate('');
      setShowDatePicker(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Saves quantity changes to the postgresql server, handle edge cases
  const updateQuantity = async (id, newQuantity) => {
    if (saving || loading || quantityRequestRunning.current) return;

    if (!Number.isFinite(newQuantity) || newQuantity === 0) {
      setError("Enter a valid non-zero change.");
      return;
    }
    quantityRequestRunning.current = true;
    setSaving(true);
    setError("");


    try {
      const savedItem = await adjustPantryQuantity(
        token,
        selectedPantry.id,
        id,
        newQuantity
      );

      setItems((current) =>
        current.map((entry) => entry.id === id ? savedItem : entry)
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      quantityRequestRunning.current = false;
    }
  };

  function confirmDeleteBatch(item) {
    if (saving || loading || quantityRequestRunning.current) return;

    Alert.alert(
      "Delete batch?",
      `Remove this ${item.quantity} ${item.unit} batch of ${item.name} from the shared pantry?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (quantityRequestRunning.current) return;
            quantityRequestRunning.current = true;
            setSaving(true);
            setError("");

            try {
              await deletePantryItem(token, selectedPantry.id, item.id);
              setItems((current) => current.filter((row) => row.id !== item.id));
            } catch (err) {
              setError(err.message);
            } finally {
              quantityRequestRunning.current = false;
              setSaving(false);
            }
          },
        },
      ]
    );
  }

  return (
    <KeyboardAvoidingView
    style={styles.container}
    behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      {saving ? <Text style={styles.mutedText}>Saving…</Text> : null}

      {!showAddItem && (
      <>
      <View style={styles.searchHeader}>
        <Text style={styles.searchLabel}>Search</Text>

        <Pressable
          onPress={() => hideEmpty ? setHideEmpty(false) : setHideEmpty(true)}
          style={({ pressed }) => [
            styles.hideEmptyTrue,
            pressed && styles.circleButtonPressed,
         ]}
          // To hide any items that are empty
        >
          {hideEmpty && (
          <Text style={styles.hideEmptyTrue}>Show Empty</Text>
          )}
          {!hideEmpty && (
          <Text style={styles.hideEmptyFalse}>Hide Empty</Text>
          )}
        </Pressable>
      </View>
      <TextInput
        placeholder="Search pantry items..."
        value={searchText}
        onChangeText={setSearchText}
        placeholderTextColor={COLORS.placeholder}
        style={styles.inputCont}
      />

      <FlatList
        data={filteredItems}
        renderItem={({ item }) => (
          <PantryItem
            {...item}
            disabled={saving || loading}
            onChangeQuantity={(q) => updateQuantity(item.id, q)}
            onDelete={() => confirmDeleteBatch(item)}
          />
        )}
        keyExtractor={item => item.id.toString()}
        refreshing={loading}
        onRefresh={refreshItems}
        ListEmptyComponent={
          <Text style={styles.mutedText}>
            {loading ? 'Loading…' : 'No matching pantry items.'}
          </Text>
        }
      />

      </>
      )}

      {!showAddItem && (
      // Hideable button to show the add item option
      <View style={styles.addButtonWrapper} pointerEvents="box-none">
      <Pressable
          onPress={() => setShowAddItem(true)}
          hitSlop={8} // Increase hit box
          style={({ pressed }) => [
            styles.circleButton,
            pressed && styles.circleButtonPressed,
         ]}
        >
          <Text style={styles.addButtonPlus}>+</Text>
      </Pressable>
      </View>
      )}

      {showAddItem && (
      <>
      <View style={styles.addHeader}>
        <Text style={styles.addTitle}>Add a new item</Text>
        <Pressable
          onPress={() => setShowAddItem(false)}
          hitSlop={12} // Increase hit box
        >
          <Text style={styles.cancelButton}>Cancel</Text>
        </Pressable>
      </View>
        {/* Name input */}
      <View style={styles.addContainer}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          placeholder="Name"
          value={name}
          onChangeText={setName}
          placeholderTextColor={COLORS.placeholder}
          style={styles.textInput}
        />

        {/* Quantity input */}
        <Text style={styles.label}>Quantity</Text>
        <TextInput
          placeholder="Quantity"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
          placeholderTextColor={COLORS.placeholder}
          style={styles.textInput}
        />

        {/* Price Input */}
        <Text style={styles.label}>Total purchase price (optional)</Text>
        <TextInput
          placeholder="e.g. 8.00"
          value={totalCost}
          onChangeText={setTotalCost}
          keyboardType="decimal-pad"
          placeholderTextColor={COLORS.placeholder}
          style={styles.textInput}
        />

        {/* Button shows current unit and tapping it opens the list */}
        <Text style={styles.label}>Unit</Text>
        <View style={styles.unitButton}>
          <Button
            title={`${unit}  ▼`}
            onPress={() => setShowUnits(true)}
            color={COLORS.blueText}
          />
        </View>

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

        {/* Optional expiration date */}
        <Text style={styles.label}>Expiration date (optional)</Text>
        <View style={styles.dateRow}>
          <View style={[styles.unitButton, styles.dateButton]}>
            <Button
              title={expirationDate || "Select date"}
              onPress={() => setShowDatePicker(true)}
              color={COLORS.blueText}
            />
          </View>
          {expirationDate !== "" && (
            <Pressable onPress={() => setExpirationDate("")}>
              <Text style={styles.cancelButton}>Clear</Text>
            </Pressable>
          )}
        </View>

        {/* Calendar shows in a centered card */}
        <Modal
          visible={showDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowDatePicker(false)}
          >
            {/* Touching card doesn't close it */}
            <Pressable style={styles.pickerCard} onPress={() => {}}>
              <DateTimePicker
                value={parseDate(expirationDate)}
                mode="date"
                display="inline"
                themeVariant="light"
                onValueChange={onDateChange}
                onDismiss={() => setShowDatePicker(false)}
              />
              <Button title="Done" color={COLORS.greenDark} onPress={() => setShowDatePicker(false)} />
            </Pressable>
          </Pressable>
        </Modal>

        <Pressable
          onPress={addItem}
          disabled={saving || loading}
          style={({ pressed }) => [
            styles.submitButton,
            (saving || loading) && styles.submitButtonDisabled,
            pressed && styles.submitButtonPressed,
          ]}
        >
          <Text style={styles.submitButtonText}>
            {saving ? "Saving…" : "Add item"}
          </Text>
        </Pressable>
      </View>
      </>
      )}
   </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: COLORS.background,
  },

  // Search
  searchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  searchLabel: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 6,
    marginLeft: 4,
    color: COLORS.greenDark,
  },
  inputCont: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 10,
    marginLeft: 4,
  },

  // Hide/Show empty toggle
  hideEmptyTrue:{
    backgroundColor: COLORS.green,
    fontWeight: 600,
    fontSize: 15,
    color: "black",
    borderWidth: 1,
    borderRadius: 3
  },
  hideEmptyFalse:{
    fontWeight: 600,
    fontSize: 15,
    color: "black",
    borderWidth: 1,
    borderRadius: 3,
    backgroundColor: COLORS.green,
  },

  // Add item form
  addHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 10,
    marginLeft: 4, // matches addContainer
  },
  addTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.greenDark,
  },
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
  unitButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 8,
    paddingVertical: 2,
    marginVertical: 4,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dateButton: {
    flex: 1,
  },
  cancelButton: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.red,
    marginRight: 8,
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

  // Date picker modal
  // Dimmed background
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  // White card that holds calendar
  pickerCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
  },

  // Add button
  addButtonWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: "center",
  },
  circleButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.green,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: COLORS.background,
    // iOS shadow
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    // Android shadow
    elevation: 8,
  },
  circleButtonPressed: {
    backgroundColor: COLORS.greenDark,
    transform: [{ scale: 0.92 }],
  },
  addButtonPlus: {
    color: COLORS.white,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "400",
  },

  errorText: {
    color: COLORS.red,
    marginBottom: 4,
  },
  mutedText: {
    color: COLORS.textMuted,
  },
});
