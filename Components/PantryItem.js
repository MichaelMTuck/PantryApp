import { View, Text, Button, StyleSheet } from "react-native";
import { getQuantityStep } from "../data/units";
import { COLORS } from "../data/theme";

// Represents a single item in the pantry
export default function PantryItem({
  id,
  name,
  quantity,
  unit,
  date,
  onChangeQuantity,
  onDelete,
  disabled = false,
}) {
  const step = getQuantityStep(unit);
  const amount = Number(quantity);

  const canAdjust =
    step !== null &&
    Number.isFinite(amount) &&
    amount >= 0;

  function changeQuantity(direction) {
    if (disabled || !canAdjust) return;

    // Match to the databases' four decimal places.
    const nextQuantity = Math.round(
      Math.max(0, amount + direction * step) * 10000
    ) / 10000;

    if (nextQuantity > 1000000000) return;

    onChangeQuantity(direction * step);
  }

    return (
        <View style={styles.card}>
            <View style={styles.left}>
                <Text>{name}</Text>
                <Text>Expires: {date || "Not provided"}</Text>
                <Button title="Delete batch" color="#b00020" onPress={onDelete} disabled={disabled} />
                {!canAdjust ? (
                <Text>
                    Unknown unit or quantity, controls unavailable for this unit or quantity.
                </Text>
                ) : null}
            </View>

            <View style={styles.quantityControls}>
                <View style={styles.quantityButton}>
                    <Button
                        title="−"
                        onPress={() => changeQuantity(-1)}
                        disabled={
                            disabled ||
                            !canAdjust ||
                            amount - step < 0
                        }
                        color={COLORS.blueText}
                    />
                </View>

                <Text style={styles.quantityText}>
                    {quantity} {unit}
                </Text>

                <View style={styles.quantityButton}>
                    <Button
                        title="+"
                        onPress={() => changeQuantity(1)}
                        disabled={
                            disabled ||
                            !canAdjust ||
                            amount + step > 1000000000
                        }
                        color={COLORS.blueText}
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
        backgroundColor: COLORS.blue,
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
