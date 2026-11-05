import { View, Text, Button, StyleSheet } from "react-native";
import { UNITS } from "../data/units";

// Represents a single item in the pantry
export default function PantryItem({ id, name, quantity, unit, date, onChangeQuantity }) {
    const step = UNITS[unit];

    return (
        <View style={styles.card}>
            <View style={styles.left}>
                <Text>{name}</Text>
                <Text>Expires: {date || "Not provided"}</Text>
            </View>

            <View style={styles.quantityControls}>
                <View style={styles.quantityButton}>
                    <Button
                        title="−"
                        onPress={() => onChangeQuantity(quantity - step)}
                        color="#FFFFFF"
                    />
                </View>

                <Text style={styles.quantityText}>
                    {quantity} {unit}
                </Text>

                <View style={styles.quantityButton}>
                    <Button
                        title="+"
                        onPress={() => onChangeQuantity(quantity + step)}
                        color="#FFFFFF"
                    />
                </View>
            </View>
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
        flexDirection: "row",
        alignItems: "center",
    },

    left: {
        flex: 1,
    },

    quantityControls: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    quantityButton: {
        backgroundColor: "#739C79",
        borderRadius: 8,
        overflow: "hidden",
    },

    quantityText: {
        fontSize: 15,
        fontWeight: "600",
        minWidth: 55,
        textAlign: "center",
    },
});
