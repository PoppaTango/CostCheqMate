import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Linking,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  CategoryRecord,
  CloudConnectionRecord,
  CloudFolderRecord,
  ExpenseRecord,
  mobileApi,
  PaymentRecord,
} from "./api";
import { clearSession, loadSession, saveSession, StoredSession } from "./storage";
import { OcrDraft } from "./types";

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
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [cloudConnections, setCloudConnections] = useState<CloudConnectionRecord[]>([]);
  const [cloudFolders, setCloudFolders] = useState<CloudFolderRecord[]>([]);
  const [cloudProvider, setCloudProvider] = useState<string>("");
  const [cloudYearFolderId, setCloudYearFolderId] = useState("");
  const [cloudYearFolderName, setCloudYearFolderName] = useState("");
  const [cloudConnectUrl, setCloudConnectUrl] = useState("");
  const [newCloudFolderName, setNewCloudFolderName] = useState("");
  const [cloudParentFolderId, setCloudParentFolderId] = useState("");
  const [cloudBrowseMode, setCloudBrowseMode] = useState(false);
  const [ocrDraft, setOcrDraft] = useState<OcrDraft | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryColor, setEditCategoryColor] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseMerchant, setNewExpenseMerchant] = useState("");
  const [newExpenseDate, setNewExpenseDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [newExpenseCategoryId, setNewExpenseCategoryId] = useState("");
  const [editingExpenseId, setEditingExpenseId] = useState("");
  const [editExpenseAmount, setEditExpenseAmount] = useState("");
  const [editExpenseMerchant, setEditExpenseMerchant] = useState("");
  const [editExpenseDate, setEditExpenseDate] = useState("");
  const [editExpenseCategoryId, setEditExpenseCategoryId] = useState("");
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === newExpenseCategoryId) || null,
    [categories, newExpenseCategoryId]
  );
  const editingExpense = useMemo(
    () => expenses.find((expense) => expense.id === editingExpenseId) || null,
    [expenses, editingExpenseId]
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
    if (!newExpenseCategoryId && categoryData.categories.length > 0) {
      setNewExpenseCategoryId(categoryData.categories[0].id);
    }
  };

  const refreshCloudData = async () => {
    const [statusData, folderData, yearData] = await Promise.all([
      mobileApi.getCloudStatus(session.accessToken),
      mobileApi.listCloudFolders(session.accessToken, {
        browse: cloudBrowseMode,
        parentId: cloudParentFolderId || undefined,
      }),
      mobileApi.getCloudYearFolder(session.accessToken),
    ]);

    setCloudConnections(statusData.connections || []);
    setCloudFolders(folderData.folders || []);
    setCloudProvider(folderData.provider || yearData.provider || "");
    setCloudYearFolderId(yearData.yearFolderId || "");
    setCloudYearFolderName(yearData.yearFolderName || "");
  };

  useEffect(() => {
    const run = async () => {
      try {
        await Promise.all([refreshFinanceData(), refreshCloudData()]);
      } catch {
        // Non-fatal. User can retry manually.
      }
    };
    run();
  }, [session.accessToken, cloudBrowseMode, cloudParentFolderId]);

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

  const selectCategoryForEdit = (category: CategoryRecord) => {
    setEditingCategoryId(category.id);
    setEditCategoryName(category.name || "");
    setEditCategoryColor(category.color || "");
  };

  const saveCategoryEdit = async () => {
    try {
      if (!editingCategoryId) {
        Alert.alert("No category selected", "Pick a category from the list first.");
        return;
      }
      if (!editCategoryName.trim()) {
        Alert.alert("Missing name", "Category name cannot be blank.");
        return;
      }
      setModuleBusy(true);
      await mobileApi.updateCategory(session.accessToken, editingCategoryId, {
        name: editCategoryName.trim(),
        color: editCategoryColor.trim() || undefined,
      });
      await refreshFinanceData();
    } catch (error) {
      Alert.alert("Update failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setModuleBusy(false);
    }
  };

  const deleteCategory = async (categoryId: string) => {
    try {
      setModuleBusy(true);
      await mobileApi.deleteCategory(session.accessToken, categoryId);
      if (editingCategoryId === categoryId) {
        setEditingCategoryId("");
        setEditCategoryName("");
        setEditCategoryColor("");
      }
      await refreshFinanceData();
    } catch (error) {
      Alert.alert("Delete failed", error instanceof Error ? error.message : "Unknown error");
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

  const selectExpenseForEdit = (expense: ExpenseRecord) => {
    setEditingExpenseId(expense.id);
    setEditExpenseAmount(String(expense.amount || ""));
    setEditExpenseMerchant(expense.merchant || "");
    setEditExpenseDate((expense.date || "").slice(0, 10));
    setEditExpenseCategoryId(expense.categoryId || "");
  };

  const saveExpenseEdit = async () => {
    try {
      if (!editingExpenseId) {
        Alert.alert("No expense selected", "Pick an expense from the list first.");
        return;
      }
      const numericAmount = Number(editExpenseAmount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        Alert.alert("Invalid amount", "Enter a valid amount greater than zero.");
        return;
      }
      if (!editExpenseDate || !editExpenseCategoryId) {
        Alert.alert("Missing fields", "Date and category are required.");
        return;
      }
      setModuleBusy(true);
      await mobileApi.updateExpense(session.accessToken, editingExpenseId, {
        amount: numericAmount,
        merchant: editExpenseMerchant || undefined,
        date: editExpenseDate,
        categoryId: editExpenseCategoryId,
      });
      await refreshFinanceData();
    } catch (error) {
      Alert.alert("Update failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setModuleBusy(false);
    }
  };

  const deleteExpense = async (expenseId: string) => {
    try {
      setModuleBusy(true);
      await mobileApi.deleteExpense(session.accessToken, expenseId);
      if (editingExpenseId === expenseId) {
        setEditingExpenseId("");
        setEditExpenseAmount("");
        setEditExpenseMerchant("");
        setEditExpenseDate("");
        setEditExpenseCategoryId("");
      }
      await refreshFinanceData();
    } catch (error) {
      Alert.alert("Delete failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setModuleBusy(false);
    }
  };

  const requestMediaAccess = async () => {
    const camera = await ImagePicker.requestCameraPermissionsAsync();
    const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return camera.granted && media.granted;
  };

  const runOcrFromAsset = async (assetUri: string, mimeType: string, fileName: string) => {
    try {
      setModuleBusy(true);
      const draft = await mobileApi.scanReceipt(
        session.accessToken,
        fileName,
        mimeType,
        assetUri
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

  const runOcrFromCamera = async () => {
    const hasAccess = await requestMediaAccess();
    if (!hasAccess) {
      Alert.alert("Permissions needed", "Camera and photo library permissions are required.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert("OCR failed", "No image data returned from camera.");
      return;
    }

    const mimeType = asset.mimeType || "image/jpeg";
    const fileName = asset.fileName || "camera-receipt.jpg";
    await runOcrFromAsset(asset.base64, mimeType, fileName);
  };

  const runOcrFromGallery = async () => {
    const hasAccess = await requestMediaAccess();
    if (!hasAccess) {
      Alert.alert("Permissions needed", "Camera and photo library permissions are required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.9,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert("OCR failed", "No image data returned from selected image.");
      return;
    }

    const mimeType = asset.mimeType || "image/jpeg";
    const fileName = asset.fileName || "library-receipt.jpg";
    await runOcrFromAsset(asset.base64, mimeType, fileName);
  };

  const createStripeCheckout = async () => {
    try {
      setModuleBusy(true);
      const returnBaseUrl = "exp://127.0.0.1:8081";
      const result = await mobileApi.createStripeCheckout(session.accessToken, {
        type: "premium_subscription",
        months: 1,
        platform: "android",
        returnUrlSuccess: `${returnBaseUrl}/--/payment/success`,
        returnUrlCancel: `${returnBaseUrl}/--/payment/cancel`,
      });
      setCheckoutUrl(result.url || "");
      if (result.url) {
        await Linking.openURL(result.url);
      }
      await refreshFinanceData();
    } catch (error) {
      Alert.alert("Checkout failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setModuleBusy(false);
    }
  };

  const createCloudConnectLink = async (provider: "onedrive" | "googledrive") => {
    try {
      setModuleBusy(true);
      const data = await mobileApi.createCloudConnectLink(session.accessToken, provider);
      setCloudConnectUrl(data.authUrl);
      Alert.alert(
        "Cloud connect URL ready",
        "Open this URL in your mobile browser to complete OAuth, then tap Refresh cloud data."
      );
    } catch (error) {
      Alert.alert(
        "Connect failed",
        error instanceof Error ? error.message : "Unknown cloud connect error"
      );
    } finally {
      setModuleBusy(false);
    }
  };

  const disconnectCloudProvider = async (provider: "onedrive" | "googledrive") => {
    try {
      setModuleBusy(true);
      await mobileApi.disconnectCloudProvider(session.accessToken, provider);
      await refreshCloudData();
    } catch (error) {
      Alert.alert(
        "Disconnect failed",
        error instanceof Error ? error.message : "Unknown cloud disconnect error"
      );
    } finally {
      setModuleBusy(false);
    }
  };

  const createCloudFolder = async () => {
    try {
      if (!newCloudFolderName.trim()) {
        Alert.alert("Missing name", "Enter a folder name first.");
        return;
      }
      setModuleBusy(true);
      await mobileApi.createCloudFolder(session.accessToken, newCloudFolderName.trim());
      setNewCloudFolderName("");
      await refreshCloudData();
    } catch (error) {
      Alert.alert(
        "Folder create failed",
        error instanceof Error ? error.message : "Unknown cloud error"
      );
    } finally {
      setModuleBusy(false);
    }
  };

  const saveYearFolder = async () => {
    try {
      setModuleBusy(true);
      await mobileApi.setCloudYearFolder(session.accessToken, {
        yearFolderId: cloudYearFolderId.trim() || null,
        yearFolderName: cloudYearFolderName.trim() || null,
      });
      await refreshCloudData();
    } catch (error) {
      Alert.alert(
        "Year folder failed",
        error instanceof Error ? error.message : "Unknown cloud error"
      );
    } finally {
      setModuleBusy(false);
    }
  };

  const clearYearFolder = async () => {
    try {
      setModuleBusy(true);
      await mobileApi.setCloudYearFolder(session.accessToken, {
        yearFolderId: null,
        yearFolderName: null,
      });
      await refreshCloudData();
    } catch (error) {
      Alert.alert(
        "Clear year folder failed",
        error instanceof Error ? error.message : "Unknown cloud error"
      );
    } finally {
      setModuleBusy(false);
    }
  };

  const assignSelectedFolderToEditingCategory = async () => {
    try {
      if (!editingCategoryId || !cloudYearFolderId) {
        Alert.alert(
          "Selection required",
          "Choose a category to edit and provide a folder ID from cloud folder list."
        );
        return;
      }
      setModuleBusy(true);
      await mobileApi.updateCategory(session.accessToken, editingCategoryId, {
        cloudFolderId: cloudYearFolderId,
        cloudFolderName: cloudYearFolderName || undefined,
      });
      await refreshFinanceData();
    } catch (error) {
      Alert.alert(
        "Map folder failed",
        error instanceof Error ? error.message : "Unknown mapping error"
      );
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
        <Button
          title={moduleBusy ? "Refreshing..." : "Refresh all mobile data"}
          onPress={async () => {
            try {
              setModuleBusy(true);
              await Promise.all([refreshFinanceData(), refreshCloudData()]);
            } catch (error) {
              Alert.alert(
                "Refresh failed",
                error instanceof Error ? error.message : "Unknown error"
              );
            } finally {
              setModuleBusy(false);
            }
          }}
          disabled={moduleBusy}
        />
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
          <Text style={{ color: "#666", marginTop: 4 }}>
            Tap "Edit" to load a category into edit form. Delete removes it permanently.
          </Text>
          {categories.slice(0, 12).map((category) => (
            <View
              key={category.id}
              style={{
                backgroundColor: "#fff",
                borderRadius: 8,
                padding: 8,
                borderWidth: 1,
                borderColor: "#e8e8e8",
                gap: 6,
              }}
            >
              <Text>
                {category.name} ({category.id})
              </Text>
              <Text style={{ color: "#666" }}>
                Color: {category.color || "n/a"} | Folder: {category.cloudFolderName || "n/a"}
              </Text>
              <Button title="Edit category" onPress={() => selectCategoryForEdit(category)} />
              <Button
                title="Delete category"
                color="#8b0000"
                disabled={moduleBusy}
                onPress={() => deleteCategory(category.id)}
              />
            </View>
          ))}
          <Text style={{ fontWeight: "600", marginTop: 8 }}>Category edit form</Text>
          <TextInput
            value={editingCategoryId}
            onChangeText={setEditingCategoryId}
            placeholder="Category ID to edit"
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
          />
          <TextInput
            value={editCategoryName}
            onChangeText={setEditCategoryName}
            placeholder="Edited name"
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
          />
          <TextInput
            value={editCategoryColor}
            onChangeText={setEditCategoryColor}
            placeholder="Edited color (hex)"
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
          />
          <Button title="Save category edit" onPress={saveCategoryEdit} disabled={moduleBusy} />
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
          <Button title="Scan receipt (camera)" onPress={runOcrFromCamera} disabled={moduleBusy} />
          <Button title="Pick receipt from gallery" onPress={runOcrFromGallery} disabled={moduleBusy} />
          <Button title="Add expense" onPress={addExpense} disabled={moduleBusy} />
          <Text style={{ color: "#666", marginTop: 4 }}>
            Tap "Edit expense" to load row data below, then save/delete.
          </Text>
          {expenses.slice(0, 20).map((expense) => (
            <View
              key={expense.id}
              style={{
                backgroundColor: "#fff",
                borderRadius: 8,
                padding: 8,
                borderWidth: 1,
                borderColor: "#e8e8e8",
                gap: 6,
              }}
            >
              <Text>
                ${expense.amount.toFixed(2)} {expense.merchant || "Unknown merchant"}
              </Text>
              <Text style={{ color: "#666" }}>
                {expense.date.slice(0, 10)} | Category: {expense.category?.name || expense.categoryId}
              </Text>
              <Text style={{ color: "#666" }}>Expense ID: {expense.id}</Text>
              <Button title="Edit expense" onPress={() => selectExpenseForEdit(expense)} />
              <Button
                title="Delete expense"
                color="#8b0000"
                disabled={moduleBusy}
                onPress={() => deleteExpense(expense.id)}
              />
            </View>
          ))}
          <Text style={{ fontWeight: "600", marginTop: 8 }}>Expense edit form</Text>
          <TextInput
            value={editingExpenseId}
            onChangeText={setEditingExpenseId}
            placeholder="Expense ID to edit"
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
          />
          <TextInput
            value={editExpenseAmount}
            onChangeText={setEditExpenseAmount}
            placeholder="Edited amount"
            keyboardType="decimal-pad"
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
          />
          <TextInput
            value={editExpenseMerchant}
            onChangeText={setEditExpenseMerchant}
            placeholder="Edited merchant"
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
          />
          <TextInput
            value={editExpenseDate}
            onChangeText={setEditExpenseDate}
            placeholder="Edited date YYYY-MM-DD"
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
          />
          <TextInput
            value={editExpenseCategoryId}
            onChangeText={setEditExpenseCategoryId}
            placeholder="Edited category ID"
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
          />
          <Button title="Save expense edit" onPress={saveExpenseEdit} disabled={moduleBusy} />
          <Text selectable>{JSON.stringify({ ocrDraft, editingExpense }, null, 2)}</Text>
        </View>

        <Text style={{ fontSize: 18, fontWeight: "600", marginTop: 8 }}>Payments</Text>
        <View style={{ backgroundColor: "#f7f7f7", borderRadius: 8, padding: 12, gap: 8 }}>
          <Button title="Create premium checkout (Stripe)" onPress={createStripeCheckout} disabled={moduleBusy} />
          <Text selectable>{JSON.stringify({ checkoutUrl, payments }, null, 2)}</Text>
          <Text style={{ color: "#666" }}>
            iOS production should use Apple IAP verification endpoint (`/api/mobile/payments/apple/verify`).
          </Text>
        </View>

        <Text style={{ fontSize: 18, fontWeight: "600", marginTop: 8 }}>Cloud Storage</Text>
        <View style={{ backgroundColor: "#f7f7f7", borderRadius: 8, padding: 12, gap: 8 }}>
          <Text style={{ color: "#666" }}>
            Provider: {cloudProvider || "Not connected"} | Connections: {cloudConnections.length}
          </Text>
          <Button
            title="Connect OneDrive"
            onPress={() => createCloudConnectLink("onedrive")}
            disabled={moduleBusy}
          />
          <Button
            title="Connect Google Drive"
            onPress={() => createCloudConnectLink("googledrive")}
            disabled={moduleBusy}
          />
          <Button
            title="Disconnect OneDrive"
            onPress={() => disconnectCloudProvider("onedrive")}
            disabled={moduleBusy}
          />
          <Button
            title="Disconnect Google Drive"
            onPress={() => disconnectCloudProvider("googledrive")}
            disabled={moduleBusy}
          />
          <Text selectable>{cloudConnectUrl || "No OAuth URL generated yet"}</Text>
          <TextInput
            value={newCloudFolderName}
            onChangeText={setNewCloudFolderName}
            placeholder="New cloud folder name"
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
          />
          <Button
            title="Create cloud folder"
            onPress={createCloudFolder}
            disabled={moduleBusy || !newCloudFolderName.trim()}
          />
          <TextInput
            value={cloudParentFolderId}
            onChangeText={setCloudParentFolderId}
            placeholder="Browse parent folder ID (optional)"
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
          />
          <Button
            title={cloudBrowseMode ? "Disable browse mode" : "Enable browse mode"}
            onPress={() => setCloudBrowseMode((previous) => !previous)}
          />
          <Text style={{ color: "#666" }}>Folders ({cloudFolders.length}):</Text>
          <Text selectable>{JSON.stringify(cloudFolders, null, 2)}</Text>
          <Text style={{ fontWeight: "600", marginTop: 8 }}>Year folder mapping</Text>
          <TextInput
            value={cloudYearFolderId}
            onChangeText={setCloudYearFolderId}
            placeholder="Year folder ID"
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
          />
          <TextInput
            value={cloudYearFolderName}
            onChangeText={setCloudYearFolderName}
            placeholder="Year folder name"
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
          />
          <Button title="Save year folder" onPress={saveYearFolder} disabled={moduleBusy} />
          <Button title="Clear year folder" onPress={clearYearFolder} disabled={moduleBusy} />
          <Button
            title="Map year folder to editing category"
            onPress={assignSelectedFolderToEditingCategory}
            disabled={moduleBusy}
          />
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
