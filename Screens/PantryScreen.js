// Displays all the ingredients currently stored in the pantry
import { useState } from "react";
import { View, Text, TextInput, FlatList, Button, StyleSheet } from "react-native";
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
    const[items, setItems] = useState(initialItems);
    return (
      //https://reactnative.dev/docs/flatlist?language=typescript
       <FlatList
        data={initialItems}
        renderItem={({item}) => <PantryItem {...item} />}
        keyExtractor={item => item.id}
      />
    );
  }
