export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface TransactionItem {
  merchant: string;
  amount: string;
  date: string;
  description?: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString("base64");

    // Determine MIME type
    const mimeType = file.type || "image/jpeg";
    const isPDF = mimeType === "application/pdf";

    // Build file content for LLM API
    const fileContent = isPDF
      ? {
          type: "file" as const,
          file: {
            filename: "bank-statement.pdf",
            file_data: `data:application/pdf;base64,${base64Image}`,
          },
        }
      : {
          type: "image_url" as const,
          image_url: {
            url: `data:${mimeType};base64,${base64Image}`,
          },
        };

    // Use LLM Vision API for bank transcript OCR
    const response = await fetch("https://apps.abacus.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are an expert at extracting transaction data from bank statements and bank app screenshots. Analyze this ${isPDF ? "document" : "image"} carefully and extract ALL transaction line items you can find.

For EACH transaction/purchase/expense, extract:
1. **Merchant/Description**: The store name, vendor, or transaction description
2. **Amount**: The transaction amount (just the number, no currency symbol). Use POSITIVE numbers for expenses/debits.
3. **Date**: The transaction date if visible (format: YYYY-MM-DD). If not visible, use empty string.

IMPORTANT RULES:
- Extract ONLY expense/debit transactions (money going out)
- IGNORE deposits, credits, income, refunds, or money coming in
- IGNORE balance figures, account numbers, headers
- If there's a date range at the top, use that context for missing dates
- Extract the merchant name as clearly as possible (e.g., "AMAZON", "WALMART", "STARBUCKS")

Respond ONLY with valid JSON array, no other text:
[{"merchant": "Store Name", "amount": "0.00", "date": "YYYY-MM-DD", "description": "optional details"}]

If no transactions found, return empty array: []
Always provide your best interpretation of the visible text.`,
              },
              fileContent,
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("LLM API error:", await response.text());
      return NextResponse.json(
        { transactions: [], error: "OCR processing failed" },
        { status: 200 }
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    // Parse the JSON response from the LLM
    try {
      // Try to extract JSON array from the response
      const jsonMatch = content.match(/\[([\s\S]*?)\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate and clean the transactions
        const transactions: TransactionItem[] = parsed
          .filter((item: any) => item && (item.merchant || item.amount))
          .map((item: any) => ({
            merchant: String(item.merchant || "").trim(),
            amount: String(item.amount || "").replace(/[^0-9.]/g, ""),
            date: item.date || "",
            description: item.description || "",
          }))
          .filter((item: TransactionItem) => {
            // Filter out items with no amount or zero amount
            const amount = parseFloat(item.amount);
            return !isNaN(amount) && amount > 0;
          });

        return NextResponse.json({
          transactions,
          count: transactions.length,
        });
      }
    } catch (parseError) {
      console.error("Failed to parse LLM response:", parseError, content);
    }

    // If parsing fails, return empty array
    return NextResponse.json(
      { transactions: [], count: 0, error: "Could not parse bank statement data" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Bank transcript OCR error:", error);
    return NextResponse.json(
      { transactions: [], count: 0, error: "OCR processing failed" },
      { status: 200 }
    );
  }
}
