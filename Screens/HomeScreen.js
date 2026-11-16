// The main dashboard screen for the app
import { ScrollView, Text, Button, View } from "react-native";

import { usePantry } from "../PantryGate";
import HouseholdPanel from "../Components/HouseholdPanel";

export default function Home() {
  const { selectedPantry, changePantry } = usePantry();

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 24, marginBottom: 12 }}>My Home</Text>

      {/* Pantry switcher only on Home screen */}
      <View style={{ marginBottom: 16 }}>
        <Text>Pantry: {selectedPantry.name}</Text>
        <Button title="Change pantry" onPress={changePantry} />
      </View>

      <HouseholdPanel key={selectedPantry.id} pantry={selectedPantry} />
    </ScrollView>
  );
}
