export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function buildFileContent(mimeType: string, base64Data: string) {
  // For PDFs, use the file content type supported by the LLM API
  if (mimeType === "application/pdf") {
    return {
      type: "file" as const,
      file: {
        filename: "receipt.pdf",
        file_data: `data:application/pdf;base64,${base64Data}`,
      },
    };
  }
  // For images, use image_url
  return {
    type: "image_url" as const,
    image_url: {
      url: `data:${mimeType};base64,${base64Data}`,
    },
  };
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
    const base64Data = buffer.toString("base64");

    // Determine MIME type
    const mimeType = file.type || "image/jpeg";
    const isPDF = mimeType === "application/pdf";

    // Use LLM Vision API for OCR
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
                text: `You are an expert at extracting data from receipt ${isPDF ? "documents" : "images"}. Analyze this receipt and extract the following information:

1. **Merchant/Store Name**: The name of the store or business
2. **Date**: The transaction date (format: YYYY-MM-DD)
3. **Total Amount**: The total amount paid (just the number, no currency symbol)

Respond ONLY with valid JSON in this exact format, no other text:
{"merchant": "Store Name", "date": "YYYY-MM-DD", "amount": "0.00"}

If you cannot find a value, use an empty string "". Always provide your best estimate based on the ${isPDF ? "document" : "image"}.`,
              },
              buildFileContent(mimeType, base64Data),
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("LLM API error:", await response.text());
      return NextResponse.json(
        { merchant: "", date: "", amount: "", error: "OCR processing failed" },
        { status: 200 }
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    // Parse the JSON response from the LLM
    try {
      const jsonMatch = content.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
          merchant: parsed.merchant || "",
          date: parsed.date || "",
          amount: parsed.amount || "",
        });
      }
    } catch (parseError) {
      console.error("Failed to parse LLM response:", parseError, content);
    }

    return NextResponse.json(
      { merchant: "", date: "", amount: "", error: "Could not parse receipt data" },
      { status: 200 }
    );
  } catch (error) {
    console.error("OCR error:", error);
    return NextResponse.json(
      { merchant: "", date: "", amount: "", error: "OCR processing failed" },
      { status: 200 }
    );
  }
}
