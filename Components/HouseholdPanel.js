import { useEffect, useState } from 'react';
import { Alert, Button, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSession } from '../Services/session';
import {createPantryInvite, getPantryMembers,} from '../Services/pantryService';

export default function HouseholdPanel({ pantry }) {
  const { token } = useSession();
  const [members, setMembers] = useState([]);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Load the pantry members from the server
  async function loadMembers() {
    setLoading(true);
    setError('');

    try {
      const result = await getPantryMembers(token, pantry.id);
      setMembers(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Handle pantry invite creation
  useEffect(() => {
    loadMembers();
  }, [token, pantry.id]);

  async function handleCreateInvite() {
    setBusy(true);
    setError('');
    setInviteCode('');

    try {
      const invite = await createPantryInvite(token, pantry.id);
      setInviteCode(invite.code);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ padding: 12, borderBottomWidth: 1, borderColor: '#ddd' }}>
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
        Household members
      </Text>

      {loading ? <Text>Loading members…</Text> : null}

      {!loading
        ? members.map((member) => (
            <Text key={member.id} style={{ marginBottom: 4 }}>
              {member.display_name} ({member.role})
            </Text>
          ))
        : null}

      {pantry.role === 'owner' && (
        <View style={{ marginTop: 8 }}>
          <Button
            title={busy ? 'Creating invite…' : 'Create invite'}
            onPress={handleCreateInvite}
            disabled={busy}
          />

          {inviteCode !== '' && (
            <View style={{ marginTop: 8 }}>
              <Text selectable>Invite code: {inviteCode}</Text>

              <Button
                title="Copy invite code"
                onPress={async () => {
                  try {
                    const copied = await Clipboard.setStringAsync(inviteCode);

                    if (!copied) {
                      throw new Error('Copy failed');
                    }

                    Alert.alert('Copied', 'The invite code is on your clipboard.');
                  } catch {
                    Alert.alert(
                      'Could not copy',
                      'Press and hold the code to copy it manually.'
                    );
                  }
                }}
              />
            </View>
          )}
        </View>
      )}

      {error ? (
        <Text style={{ color: '#b00020', marginTop: 8 }}>{error}</Text>
      ) : null}

      <View style={{ marginTop: 8 }}>
        <Button
          title="Refresh members"
          onPress={loadMembers}
          disabled={loading || busy}
        />
      </View>
    </View>
  );
}