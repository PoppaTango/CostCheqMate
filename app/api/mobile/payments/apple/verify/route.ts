import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { prisma } from "@/lib/db";
import { addBusinessTime, addPremiumTime } from "@/lib/cheqs";

type AppleVerifyRequest = {
  receiptData?: string;
  signedTransactionInfo?: string;
  signedPayload?: string;
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  isSandbox?: boolean;
  platform?: string;
};

type ReceiptInAppTransaction = {
  product_id?: string;
  transaction_id?: string;
  original_transaction_id?: string;
  purchase_date_ms?: string;
  expires_date_ms?: string;
};

type AppleVerifyResponse = {
  status: number;
  environment?: string;
  receipt?: {
    in_app?: ReceiptInAppTransaction[];
  };
  latest_receipt_info?: ReceiptInAppTransaction[];
};

type ParsedSignedTransaction = {
  productId: string;
  transactionId: string;
  originalTransactionId?: string;
  purchaseDate?: Date;
  expiresDate?: Date;
  environment?: string;
  bundleId?: string;
  appAccountToken?: string;
  payload: Record<string, unknown>;
};

type VerifiedTransaction = {
  productId: string;
  transactionId: string;
  originalTransactionId?: string;
  purchaseDate?: Date;
  expiresDate?: Date;
  environment: string;
  source: "signed_jws" | "app_store_server_api" | "verify_receipt";
  raw: Record<string, unknown>;
};

type AppStoreServerApiConfig = {
  issuerId: string;
  keyId: string;
  privateKey: string;
  bundleId: string;
};

const APPLE_PRODUCTION_VERIFY_URL = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX_VERIFY_URL = "https://sandbox.itunes.apple.com/verifyReceipt";
const APPLE_SERVER_API_PRODUCTION_URL = "https://api.storekit.itunes.apple.com";
const APPLE_SERVER_API_SANDBOX_URL = "https://api.storekit-sandbox.itunes.apple.com";

function parseCommaList(value: string | undefined, fallback: string[]) {
  if (!value) return fallback;
  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

function resolvePlanFromProductId(productId: string) {
  const normalized = productId.toLowerCase();
  const businessProducts = parseCommaList(process.env.APPLE_IAP_BUSINESS_PRODUCTS, [
    "business",
    "costcheqmate.business",
  ]);
  const premiumProducts = parseCommaList(process.env.APPLE_IAP_PREMIUM_PRODUCTS, [
    "premium",
    "costcheqmate.premium",
  ]);

  const isBusiness = businessProducts.some((token) => normalized.includes(token.toLowerCase()));
  const isPremium = premiumProducts.some((token) => normalized.includes(token.toLowerCase()));

  if (!isBusiness && !isPremium) {
    return null;
  }

  if (isBusiness) {
    return {
      accountType: "business" as const,
      months: 1 as const,
      amount: 9.99,
      paymentType: "ios_business",
    };
  }

  return {
    accountType: "premium" as const,
    months: 1 as const,
    amount: 1.99,
    paymentType: "ios_premium",
  };
}

function parseDateFromUnknown(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const maybeNumber = Number(value);
  if (Number.isFinite(maybeNumber)) {
    const dateFromMs = new Date(maybeNumber);
    if (!Number.isNaN(dateFromMs.getTime())) return dateFromMs;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function parseSignedTransactionInfo(signedToken: string): ParsedSignedTransaction | null {
  const token = signedToken.trim();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>;
    const transactionId = String(payload.transactionId || payload.transaction_id || "");
    const productId = String(payload.productId || payload.product_id || "");
    if (!transactionId || !productId) return null;

    return {
      productId,
      transactionId,
      originalTransactionId:
        String(payload.originalTransactionId || payload.original_transaction_id || "") || undefined,
      purchaseDate: parseDateFromUnknown(payload.purchaseDate || payload.purchase_date_ms),
      expiresDate: parseDateFromUnknown(payload.expiresDate || payload.expires_date_ms),
      environment: String(payload.environment || "") || undefined,
      bundleId: String(payload.bundleId || payload.bundle_id || "") || undefined,
      appAccountToken: String(payload.appAccountToken || "") || undefined,
      payload,
    };
  } catch {
    return null;
  }
}

function getAppStoreServerApiConfig(): AppStoreServerApiConfig | null {
  const issuerId = process.env.APPLE_IAP_ISSUER_ID;
  const keyId = process.env.APPLE_IAP_KEY_ID;
  const privateKey = process.env.APPLE_IAP_PRIVATE_KEY;
  const bundleId = process.env.APPLE_IAP_BUNDLE_ID;
  if (!issuerId || !keyId || !privateKey || !bundleId) {
    return null;
  }
  return {
    issuerId,
    keyId,
    privateKey: privateKey.replace(/\\n/g, "\n"),
    bundleId,
  };
}

function issueAppStoreServerToken(config: AppStoreServerApiConfig) {
  return jwt.sign(
    {
      bid: config.bundleId,
    },
    config.privateKey,
    {
      algorithm: "ES256",
      issuer: config.issuerId,
      audience: "appstoreconnect-v1",
      expiresIn: "5m",
      header: {
        alg: "ES256",
        kid: config.keyId,
        typ: "JWT",
      },
    }
  );
}

async function fetchSignedTransactionInfoFromApple(
  transactionId: string,
  useSandbox: boolean
): Promise<string | null> {
  const config = getAppStoreServerApiConfig();
  if (!config) return null;

  const token = issueAppStoreServerToken(config);
  const baseUrl = useSandbox ? APPLE_SERVER_API_SANDBOX_URL : APPLE_SERVER_API_PRODUCTION_URL;
  const response = await fetch(`${baseUrl}/inApps/v1/transactions/${transactionId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.warn(
      `App Store Server API lookup failed for ${transactionId} (HTTP ${response.status})`,
      errorBody
    );
    return null;
  }

  const body = (await response.json()) as { signedTransactionInfo?: string };
  return typeof body.signedTransactionInfo === "string" ? body.signedTransactionInfo : null;
}

async function verifyWithAppleReceipt(receiptData: string, useSandbox: boolean) {
  const payload: Record<string, string | boolean> = {
    "receipt-data": receiptData,
    "exclude-old-transactions": true,
  };
  if (process.env.APPLE_IAP_SHARED_SECRET) {
    payload.password = process.env.APPLE_IAP_SHARED_SECRET;
  }

  const response = await fetch(
    useSandbox ? APPLE_SANDBOX_VERIFY_URL : APPLE_PRODUCTION_VERIFY_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) {
    throw new Error(`Apple receipt verify failed with HTTP ${response.status}`);
  }
  return (await response.json()) as AppleVerifyResponse;
}

function findMatchingReceiptTransaction(
  response: AppleVerifyResponse,
  productId: string,
  transactionId: string,
  originalTransactionId?: string
) {
  const candidates = [
    ...(Array.isArray(response.latest_receipt_info) ? response.latest_receipt_info : []),
    ...(Array.isArray(response.receipt?.in_app) ? response.receipt?.in_app || [] : []),
  ];

  return (
    candidates.find((item) => {
      const productMatches = item.product_id === productId;
      const transactionMatches = item.transaction_id === transactionId;
      const originalMatches = originalTransactionId
        ? item.original_transaction_id === originalTransactionId
        : true;
      return productMatches && transactionMatches && originalMatches;
    }) || null
  );
}

function isConflict(existingValue: string | undefined, requestedValue: string | undefined) {
  return Boolean(existingValue && requestedValue && existingValue !== requestedValue);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = (await request.json()) as AppleVerifyRequest;
    const platform = String(body.platform || "ios").toLowerCase();
    if (platform !== "ios") {
      return NextResponse.json(
        { error: "This endpoint only accepts iOS purchase verification payloads" },
        { status: 400 }
      );
    }

    const receiptData = String(body.receiptData || "");
    const requestedProductId = String(body.productId || "") || undefined;
    const requestedTransactionId = String(body.transactionId || "") || undefined;
    const requestedOriginalTransactionId = String(body.originalTransactionId || "") || undefined;

    let verified: VerifiedTransaction | null = null;
    const requestedUseSandbox = Boolean(body.isSandbox);
    let signedToken =
      String(body.signedTransactionInfo || body.signedPayload || "") || null;

    if (!signedToken && requestedTransactionId) {
      signedToken = await fetchSignedTransactionInfoFromApple(
        requestedTransactionId,
        requestedUseSandbox
      );
      if (!signedToken) {
        signedToken = await fetchSignedTransactionInfoFromApple(requestedTransactionId, !requestedUseSandbox);
      }
    }

    if (signedToken) {
      const parsed = parseSignedTransactionInfo(signedToken);
      if (parsed) {
        const expectedBundleId = process.env.APPLE_IAP_BUNDLE_ID;
        if (expectedBundleId && parsed.bundleId && parsed.bundleId !== expectedBundleId) {
          return NextResponse.json(
            {
              status: "verification_failed",
              message: "Signed transaction bundle ID does not match expected app bundle.",
            },
            { status: 400 }
          );
        }
        if (isConflict(parsed.transactionId, requestedTransactionId)) {
          return NextResponse.json(
            {
              status: "verification_failed",
              message: "Signed transaction does not match provided transactionId.",
            },
            { status: 400 }
          );
        }
        if (isConflict(parsed.productId, requestedProductId)) {
          return NextResponse.json(
            {
              status: "verification_failed",
              message: "Signed transaction does not match provided productId.",
            },
            { status: 400 }
          );
        }

        verified = {
          productId: parsed.productId,
          transactionId: parsed.transactionId,
          originalTransactionId: parsed.originalTransactionId || requestedOriginalTransactionId,
          purchaseDate: parsed.purchaseDate,
          expiresDate: parsed.expiresDate,
          environment:
            parsed.environment || (requestedUseSandbox ? "Sandbox" : "Production"),
          source: getAppStoreServerApiConfig() ? "app_store_server_api" : "signed_jws",
          raw: {
            signedTransactionInfo: signedToken,
            payload: parsed.payload,
          },
        };
      }
    }

    if (!verified && receiptData) {
      if (!requestedProductId || !requestedTransactionId) {
        return NextResponse.json(
          {
            error:
              "productId and transactionId are required when verifying with legacy receipt data",
          },
          { status: 400 }
        );
      }

      let appleResponse = await verifyWithAppleReceipt(receiptData, false);
      if (appleResponse.status === 21007) {
        appleResponse = await verifyWithAppleReceipt(receiptData, true);
      }
      if (appleResponse.status !== 0) {
        return NextResponse.json(
          {
            status: "verification_failed",
            message: `Apple receipt verification failed (status ${appleResponse.status})`,
          },
          { status: 400 }
        );
      }

      const matched = findMatchingReceiptTransaction(
        appleResponse,
        requestedProductId,
        requestedTransactionId,
        requestedOriginalTransactionId
      );
      if (!matched) {
        return NextResponse.json(
          {
            status: "verification_failed",
            message: "Verified receipt does not contain the requested transaction.",
          },
          { status: 400 }
        );
      }

      verified = {
        productId: requestedProductId,
        transactionId: requestedTransactionId,
        originalTransactionId:
          matched.original_transaction_id || requestedOriginalTransactionId,
        purchaseDate: parseDateFromUnknown(matched.purchase_date_ms),
        expiresDate: parseDateFromUnknown(matched.expires_date_ms),
        environment: appleResponse.environment || "Unknown",
        source: "verify_receipt",
        raw: {
          verifyReceiptStatus: appleResponse.status,
          environment: appleResponse.environment || null,
          transaction: matched,
        },
      };
    }

    if (!verified) {
      return NextResponse.json(
        {
          error:
            "Unable to verify Apple transaction. Provide signedTransactionInfo or receiptData.",
        },
        { status: 400 }
      );
    }

    const plan = resolvePlanFromProductId(verified.productId);
    if (!plan) {
      return NextResponse.json(
        {
          status: "verification_failed",
          message: "Unknown Apple productId. Configure APPLE_IAP_*_PRODUCTS env vars.",
        },
        { status: 400 }
      );
    }

    const existingTransaction = await prisma.appleIapTransaction.findUnique({
      where: { transactionId: verified.transactionId },
      include: { payment: true },
    });
    if (existingTransaction && existingTransaction.userId !== auth.userId) {
      return NextResponse.json(
        {
          status: "verification_failed",
          message: "This Apple transaction is already linked to a different account.",
        },
        { status: 403 }
      );
    }
    if (
      existingTransaction?.status === "verified" &&
      existingTransaction.payment &&
      existingTransaction.payment.status === "completed"
    ) {
      return NextResponse.json({
        status: "already_verified",
        message: "Apple purchase already verified.",
        paymentId: existingTransaction.payment.id,
        transactionId: verified.transactionId,
        productId: verified.productId,
        expiresAt: existingTransaction.expiresDate?.toISOString() || null,
        verificationSource: verified.source,
      });
    }

    const rawResponse = JSON.stringify(verified.raw);
    const iapRecord = await prisma.appleIapTransaction.upsert({
      where: { transactionId: verified.transactionId },
      update: {
        userId: auth.userId,
        productId: verified.productId,
        originalTransactionId: verified.originalTransactionId || null,
        environment: verified.environment,
        purchaseDate: verified.purchaseDate,
        expiresDate: verified.expiresDate,
        rawResponse,
        status: "processing",
      },
      create: {
        userId: auth.userId,
        transactionId: verified.transactionId,
        originalTransactionId: verified.originalTransactionId || null,
        productId: verified.productId,
        environment: verified.environment,
        status: "processing",
        purchaseDate: verified.purchaseDate,
        expiresDate: verified.expiresDate,
        rawResponse,
      },
    });

    let payment = iapRecord.paymentId
      ? await prisma.payment.findUnique({ where: { id: iapRecord.paymentId } })
      : null;
    if (!payment) {
      payment = await prisma.payment.create({
        data: {
          userId: auth.userId,
          amount: plan.amount,
          currency: "USD",
          type: plan.paymentType,
          status: "pending",
          stripePaymentId: verified.transactionId,
          note: `Apple IAP ${plan.accountType} plan`,
          metadata: JSON.stringify({
            platform: "ios",
            productId: verified.productId,
            transactionId: verified.transactionId,
            originalTransactionId: verified.originalTransactionId || null,
            source: "mobile_iap",
            verificationSource: verified.source,
          }),
        },
      });
      await prisma.appleIapTransaction.update({
        where: { id: iapRecord.id },
        data: { paymentId: payment.id },
      });
    }

    if (payment.status === "completed") {
      await prisma.appleIapTransaction.update({
        where: { id: iapRecord.id },
        data: {
          status: "verified",
          expiresDate: verified.expiresDate ?? iapRecord.expiresDate,
        },
      });
      return NextResponse.json({
        status: "already_verified",
        message: "Apple purchase already verified.",
        paymentId: payment.id,
        transactionId: verified.transactionId,
        productId: verified.productId,
        expiresAt: verified.expiresDate?.toISOString() || null,
        verificationSource: verified.source,
      });
    }

    const entitlementExpiresAt =
      plan.accountType === "business"
        ? await addBusinessTime(auth.userId, plan.months)
        : await addPremiumTime(auth.userId, plan.months);

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "completed",
          completedAt: new Date(),
        },
      }),
      prisma.appleIapTransaction.update({
        where: { id: iapRecord.id },
        data: {
          paymentId: payment.id,
          status: "verified",
          expiresDate: entitlementExpiresAt,
          rawResponse,
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: auth.userId,
          action: "ios_iap_verified",
          details: JSON.stringify({
            paymentId: payment.id,
            productId: verified.productId,
            transactionId: verified.transactionId,
            accountType: plan.accountType,
            expiresAt: entitlementExpiresAt.toISOString(),
            verificationSource: verified.source,
          }),
        },
      }),
    ]);

    return NextResponse.json({
      status: "verified",
      message: "Apple IAP verified successfully.",
      paymentId: payment.id,
      transactionId: verified.transactionId,
      productId: verified.productId,
      expiresAt: entitlementExpiresAt.toISOString(),
      verificationSource: verified.source,
    });
  } catch (error) {
    console.error("Apple IAP verify error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
