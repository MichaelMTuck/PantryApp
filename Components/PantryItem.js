import { View, Text, StyleSheet } from "react-native";

// Represents a single item in the pantry
export default function PantryItem({id, name, quantity, unit, date}){
    return (
        <View style={styles.card}>
            <View style={styles.left}>
                <Text>{name}</Text>
                <Text>Expires: {date}</Text>
            </View>
            <Text>
                {quantity} {unit}
            </Text>
    </View>
  );
}

const styles = StyleSheet.create({
    card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },

    left: { flex: 1 },
});