import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Modal,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as LocalAuthentication from "expo-local-authentication";
import {
  CategoryRecord,
  CloudConnectionRecord,
  CloudFolderRecord,
  ExpenseRecord,
  MobileApiError,
  PremiumTrialStatus,
  mobileApi,
  PaymentRecord,
} from "./api";
import {
  clearSession,
  getBiometricEnabled,
  loadSession,
  runBiometricUnlock,
  saveSession,
  setBiometricEnabled as persistBiometricEnabled,
  StoredSession,
} from "./storage";
import { OcrDraft } from "./types";
import {
  enqueueOfflineMutation,
  flushOfflineQueue,
  getOfflineQueue,
  OfflineQueueItem,
} from "./offline-queue";

type PremiumTrialInfo = PremiumTrialStatus | null;

function parsePremiumTrialFromUnknown(value: unknown): PremiumTrialInfo {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.limit !== "number" ||
    typeof candidate.usedActions !== "number" ||
    typeof candidate.remainingActions !== "number" ||
    typeof candidate.currentPeriodStart !== "string" ||
    typeof candidate.nextResetAt !== "string" ||
    typeof candidate.hasFullPremiumAccess !== "boolean" ||
    typeof candidate.isFreeTrialEligible !== "boolean"
  ) {
    return null;
  }
  return candidate as unknown as PremiumTrialStatus;
}

function buildPremiumTrialMessage(trial: PremiumTrialInfo) {
  if (!trial) {
    return "Free accounts include 10 Premium actions per month.";
  }
  return `Free plan usage: ${trial.usedActions}/${trial.limit} used this month, ${trial.remainingActions} remaining.`;
}

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
  const [premiumTrial, setPremiumTrial] = useState<PremiumTrialInfo>(null);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);
  const [offlineSummary, setOfflineSummary] = useState("");
  const [biometricSettingsVisible, setBiometricSettingsVisible] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricLocked, setBiometricLocked] = useState(false);

  const userDisplay = useMemo(() => {
    return session.user?.name || session.user?.email || "User";
  }, [session.user?.email, session.user?.name]);

  const premiumTrialSummary = useMemo(() => {
    if (!premiumTrial) {
      return "Premium trial usage unavailable.";
    }
    return `Used ${premiumTrial.usedActions}/${premiumTrial.limit} actions this month. Remaining: ${premiumTrial.remainingActions}.`;
  }, [premiumTrial]);

  const handlePotentialUpgradeRequired = (error: unknown, context: string) => {
    if (!(error instanceof MobileApiError) || error.status !== 403) {
      return false;
    }
    const payload = error.payload || {};
    const upgradeRequired = payload.upgradeRequired === true;
    if (!upgradeRequired) {
      return false;
    }
    const trial = parsePremiumTrialFromUnknown(payload.premiumTrial);
    if (trial) {
      setPremiumTrial(trial);
    }
    const remainingText =
      trial && trial.isFreeTrialEligible
        ? ` Remaining this month: ${trial.remainingActions}/${trial.limit}.`
        : "";
    Alert.alert(
      "Premium Required",
      `${context}: ${error.message}.${remainingText} Upgrade to continue using this feature.`
    );
    return true;
  };

  const refreshPremiumTrial = async () => {
    try {
      const result = await mobileApi.getPremiumTrialStatus(session.accessToken);
      setPremiumTrial(result.premiumTrial || null);
    } catch {
      // Non-fatal if endpoint is temporarily unavailable.
    }
  };

  const refreshOfflineQueue = async () => {
    const queue = await getOfflineQueue();
    setOfflineQueue(queue);
  };

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
    await refreshPremiumTrial();
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
    if (statusData.premiumTrial) {
      setPremiumTrial(statusData.premiumTrial);
    }
    setCloudFolders(folderData.folders || []);
    setCloudProvider(folderData.provider || yearData.provider || "");
    setCloudYearFolderId(yearData.yearFolderId || "");
    setCloudYearFolderName(yearData.yearFolderName || "");
    if (yearData.premiumTrial) {
      setPremiumTrial(yearData.premiumTrial);
    }
  };

  const initializeSecurityAndQueue = async () => {
    const [enabled, hasHardware, enrolled] = await Promise.all([
      getBiometricEnabled(),
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    const supported = hasHardware && enrolled;
    setBiometricEnabled(enabled);
    setBiometricSupported(supported);
    if (enabled && supported) {
      const unlocked = await runBiometricUnlock();
      setBiometricLocked(!unlocked.ok);
      if (!unlocked.ok) {
        Alert.alert(
          "Biometric lock enabled",
          unlocked.reason || "Unlock required before using the app."
        );
      }
    } else {
      setBiometricLocked(false);
    }
    await refreshOfflineQueue();
  };

  useEffect(() => {
    const run = async () => {
      try {
        await Promise.all([
          refreshFinanceData(),
          refreshCloudData(),
          initializeSecurityAndQueue(),
        ]);
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
      const queueResult = await flushOfflineQueue(session.accessToken);
      setOfflineSummary(
        queueResult.remaining > 0
          ? `Synced. Processed ${queueResult.processed}, failed ${queueResult.failed}, remaining ${queueResult.remaining}.`
          : `Synced and flushed ${queueResult.processed} queued action(s).`
      );
      await refreshOfflineQueue();
    } catch (error) {
      Alert.alert("Sync failed", error instanceof Error ? error.message : "Unknown");
    } finally {
      setLoading(false);
    }
  };

  const executeWithBiometricGate = async (task: () => Promise<void>) => {
    if (!biometricEnabled || !biometricLocked) {
      await task();
      return;
    }
    const unlocked = await runBiometricUnlock();
    if (!unlocked.ok) {
      Alert.alert("Unlock required", unlocked.reason || "Authenticate to continue.");
      return;
    }
    setBiometricLocked(false);
    await task();
  };

  const addCategory = async () => {
    await executeWithBiometricGate(async () => {
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
    });
  };

  const selectCategoryForEdit = (category: CategoryRecord) => {
    setEditingCategoryId(category.id);
    setEditCategoryName(category.name || "");
    setEditCategoryColor(category.color || "");
  };

  const saveCategoryEdit = async () => {
    await executeWithBiometricGate(async () => {
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
    });
  };

  const deleteCategory = async (categoryId: string) => {
    await executeWithBiometricGate(async () => {
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
    });
  };

  const addExpense = async () => {
    await executeWithBiometricGate(async () => {
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
      if (handlePotentialUpgradeRequired(error, "Expense create")) {
        return;
      }
      Alert.alert("Expense failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setModuleBusy(false);
    }
    });
  };

  const queueExpenseOffline = async () => {
    try {
      if (!newExpenseAmount || !newExpenseCategoryId || !newExpenseDate) {
        Alert.alert("Missing fields", "Amount, category, and date are required.");
        return;
      }
      await enqueueOfflineMutation({
        type: "create_expense",
        payload: {
          amount: Number(newExpenseAmount),
          merchant: newExpenseMerchant || undefined,
          categoryId: newExpenseCategoryId,
          date: newExpenseDate,
        },
      });
      setOfflineSummary("Saved to offline queue. It will sync when you flush queue.");
      await refreshOfflineQueue();
    } catch (error) {
      Alert.alert("Offline queue failed", error instanceof Error ? error.message : "Unknown error");
    }
  };

  const flushQueuedMutationsNow = async () => {
    try {
      setModuleBusy(true);
      const result = await flushOfflineQueue(session.accessToken);
      setOfflineSummary(
        result.remaining > 0
          ? `Processed ${result.processed}, failed ${result.failed}, remaining ${result.remaining}.`
          : `Processed ${result.processed} queued action(s).`
      );
      await refreshOfflineQueue();
      if (result.processed > 0) {
        await refreshFinanceData();
      }
    } catch (error) {
      Alert.alert("Queue flush failed", error instanceof Error ? error.message : "Unknown error");
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
    await executeWithBiometricGate(async () => {
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
    });
  };

  const deleteExpense = async (expenseId: string) => {
    await executeWithBiometricGate(async () => {
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
    });
  };

  const requestMediaAccess = async () => {
    const camera = await ImagePicker.requestCameraPermissionsAsync();
    const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return camera.granted && media.granted;
  };

  const runOcrFromAsset = async (assetUri: string, mimeType: string, fileName: string) => {
    await executeWithBiometricGate(async () => {
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
    });
  };

  const runOcrFromCamera = async () => {
    const hasAccess = await requestMediaAccess();
    if (!hasAccess) {
      Alert.alert("Permissions needed", "Camera and photo library permissions are required.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
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
      mediaTypes: "images",
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
    await executeWithBiometricGate(async () => {
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
    });
  };

  const createCloudConnectLink = async (provider: "onedrive" | "googledrive") => {
    await executeWithBiometricGate(async () => {
    try {
      setModuleBusy(true);
      const data = await mobileApi.createCloudConnectLink(session.accessToken, provider);
      setCloudConnectUrl(data.authUrl);
      Alert.alert(
        "Cloud connect URL ready",
        "Open this URL in your mobile browser to complete OAuth, then tap Refresh cloud data."
      );
    } catch (error) {
      if (handlePotentialUpgradeRequired(error, "Cloud connect")) {
        return;
      }
      Alert.alert(
        "Connect failed",
        error instanceof Error ? error.message : "Unknown cloud connect error"
      );
    } finally {
      setModuleBusy(false);
    }
    });
  };

  const disconnectCloudProvider = async (provider: "onedrive" | "googledrive") => {
    await executeWithBiometricGate(async () => {
    try {
      setModuleBusy(true);
      await mobileApi.disconnectCloudProvider(session.accessToken, provider);
      await refreshCloudData();
    } catch (error) {
      if (handlePotentialUpgradeRequired(error, "Cloud disconnect")) {
        return;
      }
      Alert.alert(
        "Disconnect failed",
        error instanceof Error ? error.message : "Unknown cloud disconnect error"
      );
    } finally {
      setModuleBusy(false);
    }
    });
  };

  const createCloudFolder = async () => {
    await executeWithBiometricGate(async () => {
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
      if (handlePotentialUpgradeRequired(error, "Cloud folder create")) {
        return;
      }
      Alert.alert(
        "Folder create failed",
        error instanceof Error ? error.message : "Unknown cloud error"
      );
    } finally {
      setModuleBusy(false);
    }
    });
  };

  const saveYearFolder = async () => {
    await executeWithBiometricGate(async () => {
    try {
      setModuleBusy(true);
      await mobileApi.setCloudYearFolder(session.accessToken, {
        yearFolderId: cloudYearFolderId.trim() || null,
        yearFolderName: cloudYearFolderName.trim() || null,
      });
      await refreshCloudData();
    } catch (error) {
      if (handlePotentialUpgradeRequired(error, "Year-folder set")) {
        return;
      }
      Alert.alert(
        "Year folder failed",
        error instanceof Error ? error.message : "Unknown cloud error"
      );
    } finally {
      setModuleBusy(false);
    }
    });
  };

  const clearYearFolder = async () => {
    await executeWithBiometricGate(async () => {
    try {
      setModuleBusy(true);
      await mobileApi.setCloudYearFolder(session.accessToken, {
        yearFolderId: null,
        yearFolderName: null,
      });
      await refreshCloudData();
    } catch (error) {
      if (handlePotentialUpgradeRequired(error, "Year-folder clear")) {
        return;
      }
      Alert.alert(
        "Clear year folder failed",
        error instanceof Error ? error.message : "Unknown cloud error"
      );
    } finally {
      setModuleBusy(false);
    }
    });
  };

  const assignSelectedFolderToEditingCategory = async () => {
    await executeWithBiometricGate(async () => {
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
      if (handlePotentialUpgradeRequired(error, "Category folder mapping")) {
        return;
      }
      Alert.alert(
        "Map folder failed",
        error instanceof Error ? error.message : "Unknown mapping error"
      );
    } finally {
      setModuleBusy(false);
    }
    });
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

  const toggleBiometric = async (nextValue: boolean) => {
    try {
      if (nextValue && !biometricSupported) {
        Alert.alert(
          "Biometric unavailable",
          "This device does not have enrolled biometrics."
        );
        return;
      }
      if (nextValue) {
        const unlock = await runBiometricUnlock();
        if (!unlock.ok) {
          Alert.alert("Biometric setup failed", unlock.reason || "Unable to enable biometric lock.");
          return;
        }
      }
      await persistBiometricEnabled(nextValue);
      setBiometricEnabled(nextValue);
      if (!nextValue) {
        setBiometricLocked(false);
      }
    } catch (error) {
      Alert.alert("Biometric setting failed", error instanceof Error ? error.message : "Unknown error");
    }
  };

  const unlockBiometricGate = async () => {
    const unlocked = await runBiometricUnlock();
    if (unlocked.ok) {
      setBiometricLocked(false);
      return;
    }
    Alert.alert("Unlock failed", unlocked.reason || "Biometric authentication failed.");
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

        <Text style={{ fontSize: 18, fontWeight: "600", marginTop: 8 }}>Premium Trial Status</Text>
        <View style={{ backgroundColor: "#f7f7f7", borderRadius: 8, padding: 12, gap: 8 }}>
          <Text style={{ color: "#333" }}>{premiumTrialSummary}</Text>
          {premiumTrial?.nextResetAt ? (
            <Text style={{ color: "#666" }}>
              Resets on {new Date(premiumTrial.nextResetAt).toLocaleDateString()}.
            </Text>
          ) : null}
          <Button
            title="Refresh premium trial status"
            onPress={refreshPremiumTrial}
            disabled={moduleBusy}
          />
        </View>

        <Text style={{ fontSize: 18, fontWeight: "600", marginTop: 8 }}>Security</Text>
        <View style={{ backgroundColor: "#f7f7f7", borderRadius: 8, padding: 12, gap: 8 }}>
          <Text style={{ color: "#333" }}>Enable biometric app lock</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: "#666", flex: 1, paddingRight: 8 }}>
              {biometricSupported
                ? "Face ID / Touch ID is available on this device."
                : "Biometrics are not available or not enrolled."}
            </Text>
            <Switch value={biometricEnabled} onValueChange={toggleBiometric} />
          </View>
          {biometricEnabled && biometricLocked ? (
            <Button title="Unlock app now" onPress={unlockBiometricGate} />
          ) : null}
        </View>

        <Text style={{ fontSize: 18, fontWeight: "600", marginTop: 8 }}>Offline Queue</Text>
        <View style={{ backgroundColor: "#f7f7f7", borderRadius: 8, padding: 12, gap: 8 }}>
          <Text style={{ color: "#333" }}>
            {offlineQueue.length} queued mutation{offlineQueue.length === 1 ? "" : "s"}
          </Text>
          {offlineSummary ? <Text style={{ color: "#666" }}>{offlineSummary}</Text> : null}
          <Button
            title={moduleBusy ? "Flushing..." : "Flush offline queue"}
            onPress={flushQueuedMutationsNow}
            disabled={moduleBusy || offlineQueue.length === 0}
          />
        </View>

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
          <Button title="Queue expense offline" onPress={queueExpenseOffline} disabled={moduleBusy} />
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

      <Modal visible={biometricEnabled && biometricLocked} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View style={{ backgroundColor: "#fff", borderRadius: 10, padding: 16, gap: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>App Locked</Text>
            <Text style={{ color: "#666" }}>
              Biometric lock is enabled. Authenticate to continue.
            </Text>
            <Button title="Unlock with biometrics" onPress={unlockBiometricGate} />
            <Button title="Logout" color="#8b0000" onPress={doLogout} />
          </View>
        </View>
      </Modal>
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
