import { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { useSession } from "../Services/session";
import { getPantryItems } from "../Services/pantryService";

// Item is low stock when less than or equal these thresholds
const LOW_STOCK_THRESHOLDS = {
  items: 2,
  oz: 4,
  lbs: 0.5,
  tsp: 2,
  tbsp: 2,
  cup: 0.5,
  pint: 1,
  quart: 0.5,
  gallon: 0.25,
};

const EXPIRY_SOON_DAYS = 3;
const EXPIRY_WARN_DAYS = 7;
const COLLAPSED_COUNT = 4; // num alerts shown before Show All

// Yellow = low stock, red = expiration
const TYPE_COLORS = {
  stock: { bg: "#fff9db", border: "#f1c40f", text: "#6b5600" },
  expiry: { bg: "#fdeaea", border: "#e57373", text: "#8e2a2a" },
};

// Handles YYYY-MM-DD and timestamps from server
function parseExpiration(value) {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function daysUntil(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Round to whole number days
  return Math.round((date - today) / 86400000);
}

// No float noise
function formatQty(n) {
  return String(Math.round(n * 100) / 100);
}

function buildNotifications(items) {
  const notes = [];

  items.forEach((item) => {
    const qty = Number(item.quantity);

    // Stock alerts
    if (qty <= 0) {
      notes.push({
        key: `stock-${item.id}`,
        type: "stock",
        rank: 2,
        tag: "OUT OF STOCK",
        icon: "📦",
        message: `${item.name} is out of stock`,
      });
    } else if (qty <= LOW_STOCK_THRESHOLDS[item.unit]) {
      notes.push({
        key: `stock-${item.id}`,
        type: "stock",
        rank: 3,
        tag: "LOW STOCK",
        icon: "📦",
        message: `${item.name} is running low (${formatQty(qty)} ${item.unit} left)`,
      });
    }

    // Expiration alerts, skip items with 0 qty
    const exp = parseExpiration(item.expiration_date);
    if (exp && qty > 0) {
      const days = daysUntil(exp);
      let note = null;

      if (days < 0) {
        note = { rank: 0, tag: "EXPIRED", message: `${item.name} expired ${Math.abs(days)} days ago` };
      } else if (days === 0) {
        note = { rank: 0, tag: "EXPIRES TODAY", message: `${item.name} expires today` };
      } else if (days <= EXPIRY_SOON_DAYS) {
        note = { rank: 1, tag: "EXPIRES SOON", message: `${item.name} expires in ${days} days` };
      } else if (days <= EXPIRY_WARN_DAYS) {
        note = { rank: 4, tag: "EXPIRING", message: `${item.name} expires in ${days} days` };
      }

      if (note) {
        notes.push({ key: `exp-${item.id}`, type: "expiry", icon: "⏰", ...note });
      }
    }
  });

  // Priority sorting
  notes.sort((a, b) => a.rank - b.rank);
  return notes;
}

export default function PantryNotifications({ pantry }) {
  const { token } = useSession();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Reload when Home gains focus to match Pantry changes
  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);

      getPantryItems(token, pantry.id)
        .then((result) => {
          if (active) setItems(result);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [token, pantry.id])
  );

  const notifications = useMemo(() => buildNotifications(items), [items]);

  if (loading && items.length === 0) {
    return <Text style={styles.muted}>Checking pantry…</Text>;
  }

  if (notifications.length === 0) {
    return (
      <View style={styles.wrapper}>
        <Text style={styles.heading}>Notifications</Text>
        <Text style={styles.muted}>Nothing needs attention.</Text>
      </View>
    );
  }

  const visible = expanded ? notifications : notifications.slice(0, COLLAPSED_COUNT);
  const hiddenCount = notifications.length - visible.length;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.heading}>Notifications ({notifications.length})</Text>

      {visible.map((n) => {
        const colors = TYPE_COLORS[n.type];
        return (
          <View
            key={n.key}
            style={[
              styles.card,
              { backgroundColor: colors.bg, borderLeftColor: colors.border },
            ]}
          >
            <Text style={styles.icon}>{n.icon}</Text>
            <View style={styles.body}>
              <Text style={[styles.tag, { color: colors.text }]}>{n.tag}</Text>
              <Text style={[styles.message, { color: colors.text }]}>{n.message}</Text>
            </View>
          </View>
        );
      })}

      {notifications.length > COLLAPSED_COUNT && (
        <Pressable onPress={() => setExpanded((e) => !e)}>
          <Text style={styles.toggle}>
            {expanded ? "Show less" : `Show all (${hiddenCount} more)`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  heading: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 5,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  icon: { fontSize: 18, marginRight: 10 },
  body: { flex: 1 },
  tag: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 2 },
  message: { fontSize: 15, fontWeight: "500" },
  toggle: { color: "#2f6f4f", fontWeight: "600", marginTop: 2 },
  muted: { color: "#555", marginBottom: 8 },
});
