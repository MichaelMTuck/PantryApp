// Represents a single recipe in the app
import { Pressable, Text, StyleSheet } from "react-native";

export default function RecipeCard({id, name, time, onPress}){
    return (
        <Pressable
         onPress={onPress}
         style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.time}>{time}</Text>
        </Pressable>
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
  pressed: { opacity: 0.6 },
  name: { fontSize: 16, fontWeight: "600" },
  time: { fontSize: 12, color: "#777", marginTop: 2 },
});