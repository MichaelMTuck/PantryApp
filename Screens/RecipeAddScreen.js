import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

import { useSession } from "../Services/session";
import { usePantry } from "../PantryGate";
import { addRecipe } from "../Services/recipeService";

// Screen for adding new recipes to the app
let nextStepId = 1;
let nextIngrId = 1;
const makeStep = () => ({ id: nextStepId++, text: "" });
const makeIngr = () => ({id: nextIngrId++, text: "" })

export default function RecipeAdd(){
    const navigation = useNavigation();
    const { token } = useSession();
    const { selectedPantry } = usePantry();

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    
    const [title, setTitle] = useState('');
    const [time, setTime] = useState('');
    const [ingredients, setIngredients] = useState(() => [makeIngr()]);
    const [servings, setServings] = useState(0);

    const [steps, setSteps] = useState(() => [makeStep()]);

    const updateIngredients = (id, text) => {
        const clean = text.replace(/;/g, ",");
        setIngredients((prev) => prev.map((s) => (s.id === id ? { ...s, text: clean } : s)));
    };

    const updateStep = (id, text) => {
        // Strip ";" so it can't break the delimiter when we join the steps
        // Just an ensurance thing so we don't break it up in the sql code
        const clean = text.replace(/;/g, ",");
        // { ...s, text: clean } only returns when s.id === id is true
        setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, text: clean } : s)));
    };

    const addIngredient = () => {
        const ing = makeIngr();
        setIngredients((prev) => [...prev, ing]);
    };

    const addStep = () => {
        const step = makeStep();
        setSteps((prev) => [...prev, step]);
        // Focus after the new input has rendered, sloppy work around for rendering time
        // TODO: Find better work around for rendering steps
    };

    const removeIngredient = (id) => {
        setIngredients((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));
    }

    const removeStep = (id) => {
        setSteps((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));
    };

    // Resest form function
    const resetForm = () => {
        setTitle("");
        setTime("");
        setSteps([makeStep()]);
        setServings(0);
        setIngredients([makeIngr()])
        setError("");
    };

    // Makes sure the form is filled out before trying to submit
    const validate = () => {
        if (!title.trim()) return "Give your recipe a title.";

        const minutes = Number(time);
        if (!time.trim() || !Number.isInteger(minutes) || minutes <= 0) {
        return "Enter the time in whole minutes, like 45.";
        }

        if (!steps.some((s) => s.text.trim())) return "Add at least one step.";

        if (!ingredients.some((s) => s.text.trim())) return "Add at least ingredient.";
        return "";
    };

    // Submit function
    const handleSubmit = async () => {
        if(submitting) return; // Prevent duplicate calls

        // Check for error
        const prob = validate();
        if(prob) {
            setError(prob);
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            // Turn the steps from a list to a string for the server
            /* 
            {
                id: 12,
                name: "Pancakes",
                time: "20 min",
                servings: 4,
                ingredients: ["2 cups Flour", "1 cup Milk"],
                steps: ["Mix ingredients.", "Cook on a hot pan."]
                }
            */
            console.log({
                name: title.trim(),
                time: `${time} min`,
                servings: servings,
                ingredients: ingredients.map(ing => ing.text),
                steps: steps.map(step => step.text)
             })
            await addRecipe(token, selectedPantry.id, {
                name: title.trim(),
                time: `${time} min`,
                servings: servings,
                ingredients: ingredients.map(ing => ing.text),
                steps: steps.map(step => step.text)
             });
            resetForm();
        } catch (err) {
            setError(err.message || "Couldn't save the recipe. Try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return(
   <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Add your recipe</Text>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Grandma's tomato soup"
          value={title}
          onChangeText={setTitle}
          returnKeyType="next"
        />

        <Text style={styles.label}>Time (minutes)</Text>
        <TextInput
          style={styles.input}
          placeholder="45"
          value={time}
          // Digits only, standard copy and paste code for clean up
          onChangeText={(v) => setTime(v.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad" // Makes it so it only shows the number pad, makes it easier
        />

        <Text style={styles.label}>Ingredients</Text>
        {ingredients.map((ingredient, index) => (
            <View key={ingredient.id} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{index + 1}.</Text>

            <TextInput
              style={[styles.input, styles.stepInput]}
              placeholder="Add an ingredient"
              value={ingredient.text}
              onChangeText={(v) => updateIngredients(ingredient.id, v)}
              multiline // Lets the text scroll down
            />
            {ingredients.length > 1 && ( // If the step is bigger than one, show a remove step button
              <Pressable
                onPress={() => removeIngredient(ingredient.id)}
                hitSlop={8} // Increase hit box
              >
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            )}
          </View>
        ))}

        <Pressable onPress={addIngredient} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Add Ingredient</Text>
        </Pressable>

        <Text style={styles.label}>Steps</Text>

        {steps.map((step, index) => (
          <View key={step.id} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{index + 1}.</Text>

            <TextInput
              style={[styles.input, styles.stepInput]}
              placeholder="Describe this step"
              value={step.text}
              onChangeText={(v) => updateStep(step.id, v)}
              multiline // Lets the text scroll down
            />
            {steps.length > 1 && ( // If the step is bigger than one, show a remove step button
              <Pressable
              
                onPress={() => removeStep(step.id)}
                hitSlop={8} // Increase hit box
              >
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            )}
          </View>
        ))}

        <Pressable onPress={addStep} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Add step</Text>
        </Pressable>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          // If submititng is true, turn opacity down a bit
          style={[styles.primaryButton, submitting && styles.disabled]}
        >
          {submitting ? ( // If submitting, show the spinning wheel, if not show the text
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Save recipe</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 48 },
  heading: { fontSize: 24, fontWeight: "700", marginBottom: 16 },
  label: { fontSize: 15, fontWeight: "600", marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  stepRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  stepNumber: { width: 24, paddingTop: 11, fontSize: 16, color: "#555" },
  stepInput: { flex: 1, minHeight: 44 },
  remove: { paddingTop: 11, paddingLeft: 10, color: "#b3261e", fontSize: 14 },
  secondaryButton: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#2f6f4f",
    borderRadius: 8,
    marginTop: 4,
  },
  secondaryButtonText: { color: "#2f6f4f", fontWeight: "600" },
  error: { color: "#b3261e", marginTop: 16 },
  primaryButton: {
    backgroundColor: "#2f6f4f",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.6 },
});
