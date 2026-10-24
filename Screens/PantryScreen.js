// Displays all the ingredients currently stored in the pantry
import { useState } from "react";
import { View, Text, TextInput, FlatList, Button } from "react-native";
import PantryItem from "../Components/PantryItem";

const initialItems = [{
  id : 0,
  name: 'obj1',
  unit: "lbs",
  quantity: 5.0,
  date: "10/10/2020"
}, {
  id : 1,
  name: 'obj2',
  unit: "lbs",
  quantity: 5.0,
  date: "10/10/2020"
}, {
  id : 2,
  name: 'obj3',
  unit: "lbs",
  quantity: 5.0,
  date: "10/10/2020"
}];

export default function Pantry() {
  const [items, setItems] = useState(initialItems);
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
    <View>
      <Text>Search</Text>
      <TextInput
        placeholder="Search pantry items..."
        value={searchText}
        onChangeText={setSearchText}
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

      {/* https://reactnative.dev/docs/flatlist?language=typescript */}
      <FlatList
        data={filteredItems}
        renderItem={({ item }) => <PantryItem {...item} />}
        keyExtractor={item => item.id.toString()}
      />
    </View>
  );
}
