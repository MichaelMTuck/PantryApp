// Displays all the ingredients currently stored in the pantry
import { useState } from "react";
import { View, Text, TextInput, FlatList, Button, Modal, StyleSheet } from "react-native";
import { ITEMS } from "../data/pantryItems";
import { UNITS } from "../data/units";
import PantryItem from "../Components/PantryItem";

const UNIT_NAMES = Object.keys(UNITS);

export default function Pantry() {
  const [items, setItems] = useState(ITEMS);
  const [searchText, setSearchText] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState(UNIT_NAMES[0]);
  const [showUnits, setShowUnits] = useState(false);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const addItem = () => {
    if (!name.trim()) return;

    setItems([
      ...items,
      {
        id: items.length ? Math.max(...items.map(i => i.id)) + 1 : 0,
        name: name.trim(),
        unit,
        quantity: parseFloat(quantity) || 0,
        date: new Date().toLocaleDateString(),
      },
    ]);
    setName("");
    setQuantity("");
    setUnit(UNIT_NAMES[0]);
  };

  // Change one item's quantity, never below 0
  const updateQuantity = (id, newQuantity) => {
    const updatedItems = items.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(0, newQuantity) };
      }
      return item;
    });

    setItems(updatedItems);
  };

  return (
    <View style={styles.container}>
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

      <Button title="Add item" onPress={addItem} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: "#f5f5f5" },
});
