// Displays all the ingredients currently stored in the pantry
import { useState } from "react";
import { View, Text, TextInput, FlatList, Button, StyleSheet } from "react-native";
import { ITEMS } from "../data/pantryItems";
import PantryItem from "../Components/PantryItem";



export default function Pantry() {
  const [items, setItems] = useState(ITEMS);
  const [searchText, setSearchText] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");

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
    setUnit("");
  };

  return (
    <View style={styles.container}>
      <Text>Search</Text>
      <TextInput
        placeholder="Search pantry items..."
        value={searchText}
        onChangeText={setSearchText}
      />


      {/* https://reactnative.dev/docs/flatlist?language=typescript */}
      <FlatList
        data={filteredItems}
        renderItem={({ item }) => <PantryItem {...item} />}
        keyExtractor={item => item.id.toString()}
      />

       <Text>Add a new item</Text>
      <TextInput placeholder="Name" value={name} onChangeText={setName} />
      <TextInput
        placeholder="Quantity"
        value={quantity}
        onChangeText={setQuantity}
      />
      <TextInput placeholder="Unit" value={unit} onChangeText={setUnit} />
      <Button title="Add item" onPress={addItem} />
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: "#f5f5f5" },
});