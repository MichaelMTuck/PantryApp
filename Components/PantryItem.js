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
        padding: 14,
        flexDirection: "row",
        marginBottom : 10
    },

    left: { flex: 1 },
});