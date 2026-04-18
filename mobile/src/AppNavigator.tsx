import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { mobileApi } from "./api";
import { clearSession, loadSession, saveSession, StoredSession } from "./storage";

function LoginScreen({
  onLoggedIn,
}: {
  onLoggedIn: (session: StoredSession) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    try {
      setLoading(true);
      const session = await mobileApi.login(email.trim(), password);
      await saveSession(session);
      onLoggedIn(session);
    } catch (error) {
      Alert.alert(
        "Login failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 30, fontWeight: "700", marginBottom: 20 }}>
        CostCheqMate Mobile
      </Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      />
      <TextInput
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      />
      <Button
        title={loading ? "Signing in..." : "Sign in"}
        onPress={onLogin}
        disabled={loading || !email || !password}
      />
    </SafeAreaView>
  );
}

function DashboardScreen({
  session,
  onLogout,
}: {
  session: StoredSession;
  onLogout: () => void;
}) {
  const [profile, setProfile] = useState<unknown | null>(null);
  const [syncPayload, setSyncPayload] = useState<unknown | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const userDisplay = useMemo(() => {
    return session.user?.name || session.user?.email || "User";
  }, [session.user?.email, session.user?.name]);

  useEffect(() => {
    const run = async () => {
      try {
        const result = await mobileApi.getMe(session.accessToken);
        setProfile(result.user || null);
      } catch {
        // Profile fetch can fail if token expired; user can refresh via sync or relogin.
      }
    };
    run();
  }, [session.accessToken]);

  const runSync = async () => {
    try {
      setLoading(true);
      const result = await mobileApi.getSyncChanges({
        accessToken: session.accessToken,
        since: null,
      });
      setSyncPayload(result);
    } catch (error) {
      Alert.alert("Sync failed", error instanceof Error ? error.message : "Unknown");
    } finally {
      setLoading(false);
    }
  };

  const doLogout = async () => {
    try {
      await mobileApi.logout(session.refreshToken);
    } catch {
      // Ignore network failures on logout.
    }
    await clearSession();
    onLogout();
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>Welcome, {userDisplay}</Text>
        <Text style={{ color: "#666" }}>
          This starter app is connected to your new mobile backend endpoints.
        </Text>
        <Button title={loading ? "Syncing..." : "Run initial sync"} onPress={runSync} />
        <Button title="Logout" onPress={doLogout} color="#8b0000" />

        <Text style={{ fontSize: 18, fontWeight: "600", marginTop: 8 }}>Profile</Text>
        <View style={{ backgroundColor: "#f7f7f7", borderRadius: 8, padding: 12 }}>
          <Text selectable>{JSON.stringify(profile, null, 2)}</Text>
        </View>

        <Text style={{ fontSize: 18, fontWeight: "600", marginTop: 8 }}>Last Sync</Text>
        <View style={{ backgroundColor: "#f7f7f7", borderRadius: 8, padding: 12 }}>
          <Text selectable>{JSON.stringify(syncPayload, null, 2)}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function AppNavigator() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [session, setSession] = useState<StoredSession | null>(null);

  useEffect(() => {
    const load = async () => {
      const stored = await loadSession();
      setSession(stored);
      setBootstrapped(true);
    };
    load();
  }, []);

  if (!bootstrapped) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return <LoginScreen onLoggedIn={setSession} />;
  }

  return <DashboardScreen session={session} onLogout={() => setSession(null)} />;
}
