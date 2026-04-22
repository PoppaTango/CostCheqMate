import { NextRequest, NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/mobile-auth";

function extractJsonObject(content: string): Record<string, unknown> | null {
  const match = content.match(/\{[^}]+\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildFileContent(mimeType: string, base64Data: string) {
  if (mimeType === "application/pdf") {
    return {
      type: "file" as const,
      file: {
        filename: "receipt.pdf",
        file_data: `data:application/pdf;base64,${base64Data}`,
      },
    };
  }

  return {
    type: "image_url" as const,
    image_url: {
      url: `data:${mimeType};base64,${base64Data}`,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireMobileAuth(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const fileName = String(body?.fileName || "receipt").trim();
    const contentType = String(body?.contentType || "image/jpeg").trim();
    const base64Data = String(body?.base64Data || "").trim();
    if (!base64Data) {
      return NextResponse.json(
        { error: "base64Data is required" },
        { status: 400 }
      );
    }

    if (!process.env.ABACUSAI_API_KEY) {
      return NextResponse.json(
        { merchant: "", date: "", amount: "", error: "OCR provider not configured" },
        { status: 503 }
      );
    }

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
                text: `Extract merchant, date (YYYY-MM-DD), and total amount from this receipt.
Use the attached file named "${fileName}" and return ONLY valid JSON:
{"merchant":"", "date":"", "amount":""}`,
              },
              buildFileContent(contentType, base64Data),
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { merchant: "", date: "", amount: "", error: "OCR processing failed" },
        { status: 200 }
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJsonObject(content);

    return NextResponse.json({
      merchant: typeof parsed?.merchant === "string" ? parsed.merchant : "",
      date: typeof parsed?.date === "string" ? parsed.date : "",
      amount: typeof parsed?.amount === "string" ? parsed.amount : "",
    });
  } catch (error) {
    console.error("Mobile OCR error:", error);
    return NextResponse.json(
      { merchant: "", date: "", amount: "", error: "OCR processing failed" },
      { status: 200 }
    );
  }
}
