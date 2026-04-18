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
import { Category, Expense, MobilePayment } from "./types";

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<MobilePayment[]>([]);
  const [ocrDraft, setOcrDraft] = useState<{ merchant: string; date: string; amount: string } | null>(
    null
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseMerchant, setNewExpenseMerchant] = useState("");
  const [newExpenseDate, setNewExpenseDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [newExpenseCategoryId, setNewExpenseCategoryId] = useState("");
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === newExpenseCategoryId) || null,
    [categories, newExpenseCategoryId]
  );
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [moduleBusy, setModuleBusy] = useState(false);

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

  const refreshFinanceData = async () => {
      const [categoryData, expenseData, paymentData] = await Promise.all([
        mobileApi.listCategories(session.accessToken),
        mobileApi.listExpenses(session.accessToken),
        mobileApi.getPaymentHistory(session.accessToken),
      ]);
      setCategories(categoryData.categories);
      setExpenses(expenseData.expenses);
      setPayments(paymentData.payments);
    if (!newExpenseCategoryId && categoryData.length > 0) {
      setNewExpenseCategoryId(categoryData[0].id);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        await refreshFinanceData();
      } catch {
        // Non-fatal. User can retry manually.
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

  const addCategory = async () => {
    try {
      if (!newCategoryName.trim()) {
        Alert.alert("Missing name", "Enter a category name.");
        return;
      }
      setModuleBusy(true);
      await mobileApi.createCategory(session.accessToken, { name: newCategoryName.trim() });
      setNewCategoryName("");
      await refreshFinanceData();
    } catch (error) {
      Alert.alert("Category failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setModuleBusy(false);
    }
  };

  const addExpense = async () => {
    try {
      if (!newExpenseAmount || !newExpenseCategoryId || !newExpenseDate) {
        Alert.alert("Missing fields", "Amount, category, and date are required.");
        return;
      }
      setModuleBusy(true);
      await mobileApi.createExpense(session.accessToken, {
        amount: Number(newExpenseAmount),
        merchant: newExpenseMerchant || undefined,
        categoryId: newExpenseCategoryId,
        date: newExpenseDate,
      });
      setNewExpenseAmount("");
      setNewExpenseMerchant("");
      await refreshFinanceData();
    } catch (error) {
      Alert.alert("Expense failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setModuleBusy(false);
    }
  };

  const runOcrDemo = async () => {
    try {
      setModuleBusy(true);
      // Placeholder receipt payload for now; Phase 3 will integrate image picker + multipart upload.
      const draft = await mobileApi.scanReceipt(
        session.accessToken,
        "sample-receipt.txt",
        "text/plain",
        "U2FtcGxlIHJlY2VpcHQgdG90YWwgMTIuOTkgZnJvbSBTdG9yZQ=="
      );
      setOcrDraft(draft);
      if (!newExpenseMerchant && draft.merchant) setNewExpenseMerchant(draft.merchant);
      if (!newExpenseAmount && draft.amount) setNewExpenseAmount(draft.amount);
      if (draft.date) setNewExpenseDate(draft.date);
    } catch (error) {
      Alert.alert("OCR failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setModuleBusy(false);
    }
  };

  const createStripeCheckout = async () => {
    try {
      setModuleBusy(true);
      const result = await mobileApi.createStripeCheckout(session.accessToken, {
        type: "premium_subscription",
        months: 1,
      });
      setCheckoutUrl(result.url || "");
      if (result.url) {
        Alert.alert("Checkout created", "Copy the URL below into a browser to complete payment.");
      }
      await refreshFinanceData();
    } catch (error) {
      Alert.alert("Checkout failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setModuleBusy(false);
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

        <Text style={{ fontSize: 18, fontWeight: "600", marginTop: 8 }}>Categories</Text>
        <View style={{ backgroundColor: "#f7f7f7", borderRadius: 8, padding: 12, gap: 8 }}>
          <TextInput
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            placeholder="New category name"
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
          />
          <Button title="Add category" onPress={addCategory} disabled={moduleBusy} />
          <Text selectable>{JSON.stringify(categories, null, 2)}</Text>
        </View>

        <Text style={{ fontSize: 18, fontWeight: "600", marginTop: 8 }}>Expenses</Text>
        <View style={{ backgroundColor: "#f7f7f7", borderRadius: 8, padding: 12, gap: 8 }}>
          <TextInput
            value={newExpenseAmount}
            onChangeText={setNewExpenseAmount}
            placeholder="Amount (e.g. 12.99)"
            keyboardType="decimal-pad"
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
          />
          <TextInput
            value={newExpenseMerchant}
            onChangeText={setNewExpenseMerchant}
            placeholder="Merchant"
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
          />
          <TextInput
            value={newExpenseDate}
            onChangeText={setNewExpenseDate}
            placeholder="YYYY-MM-DD"
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
          />
          <TextInput
            value={newExpenseCategoryId}
            onChangeText={setNewExpenseCategoryId}
            placeholder="Category ID"
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
          />
          <Text style={{ color: "#666" }}>
            Selected category: {selectedCategory ? `${selectedCategory.name} (${selectedCategory.id})` : "None"}
          </Text>
          <Button title="Run OCR draft (demo)" onPress={runOcrDemo} disabled={moduleBusy} />
          <Button title="Add expense" onPress={addExpense} disabled={moduleBusy} />
          <Text selectable>{JSON.stringify({ ocrDraft, expenses }, null, 2)}</Text>
        </View>

        <Text style={{ fontSize: 18, fontWeight: "600", marginTop: 8 }}>Payments</Text>
        <View style={{ backgroundColor: "#f7f7f7", borderRadius: 8, padding: 12, gap: 8 }}>
          <Button title="Create premium checkout (Stripe)" onPress={createStripeCheckout} disabled={moduleBusy} />
          <Text selectable>{JSON.stringify({ checkoutUrl, payments }, null, 2)}</Text>
          <Text style={{ color: "#666" }}>
            iOS production should use Apple IAP verification endpoint (`/api/mobile/payments/apple/verify`).
          </Text>
        </View>

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
