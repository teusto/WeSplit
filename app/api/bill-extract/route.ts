import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ClaudeTextBlock = {
  type: string;
  text?: string;
};

type ClaudeMessageResponse = {
  content?: ClaudeTextBlock[];
};

type ClaudeErrorPayload = {
  error?: {
    type?: string;
    message?: string;
  };
};

type ExtractionConfidence = "high" | "medium" | "low";

type ReceiptExtraction = {
  total: number;
  subtotal: number | null;
  tax: number | null;
  tip: number | null;
  currency: string;
  confidence: ExtractionConfidence;
};

const extractJsonObject = (text: string): Record<string, unknown> | null => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const candidate = text.slice(start, end + 1);

  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    const withoutFences = candidate
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    try {
      return JSON.parse(withoutFences) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
};

const parseNumber = (value: unknown): number => {
  const numeric =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").replace(/[^\d.-]/g, ""));

  return Number.isFinite(numeric) ? numeric : 0;
};

const parseNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/[^\d.-]/g, ""));

  return Number.isFinite(numeric) ? numeric : null;
};

const parseConfidence = (value: unknown): ExtractionConfidence => {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return "low";
};

const normalizeExtraction = (
  parsed: Record<string, unknown> | null,
): ReceiptExtraction => {
  const rawCurrency = parsed?.currency;

  return {
    total: parseNumber(parsed?.total),
    subtotal: parseNullableNumber(parsed?.subtotal),
    tax: parseNullableNumber(parsed?.tax),
    tip: parseNullableNumber(parsed?.tip),
    currency:
      typeof rawCurrency === "string" && rawCurrency.trim()
        ? rawCurrency.trim().toUpperCase()
        : "EUR",
    confidence: parseConfidence(parsed?.confidence),
  };
};

export const POST = async (request: Request) => {
  try {
    const apiKey = process.env.CLAUDE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing CLAUDE_API_KEY environment variable." },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing image file." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const imageBase64 = Buffer.from(arrayBuffer).toString("base64");
    const mediaType = file.type || "image/jpeg";

    const prompt = [
      "You are a receipt scanner. Extract data from this receipt image and return ONLY a valid JSON object.",
      "No markdown, no explanation, no code fences. Just raw JSON.",
      "",
      "Return this exact shape:",
      "{",
      '  "total": number,',
      '  "subtotal": number or null,',
      '  "tax": number or null,',
      '  "tip": number or null,',
      '  "currency": "EUR",',
      '  "confidence": "high" | "medium" | "low"',
      "}",
      "",
      "Rules:",
      "- total is the final amount paid, always a number",
      "- If you cannot read the total clearly, set confidence to low",
      "- All prices as plain numbers, no currency symbols",
      "- If a field is not visible on the receipt, use null",
      "",
      "Portuguese terms that may appear:",
      "- Troco = change",
      "- TOTAL PAGO = total amount paid",
      "- IVA = tax",
      "- IVA Liquidado = tax liquidated",
    ].join("\n");

    const configuredModel = process.env.CLAUDE_VISION_MODEL;
    const candidateModels = [
      configuredModel,
      "claude-haiku-4-5-20251001",
      "claude-sonnet-4-20250514",
    ].filter((model): model is string => !!model);

    console.log("[bill-extract] image info", {
      fileName: file.name,
      fileType: mediaType,
      fileSizeBytes: file.size,
      base64Length: imageBase64.length,
    });
    console.log("[bill-extract] prompt", prompt);
    console.log("[bill-extract] candidate models", candidateModels);

    let claudeJson: ClaudeMessageResponse | null = null;
    let lastErrorBody = "";

    for (const model of candidateModels) {
      console.log("[bill-extract] trying model", model);

      const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 220,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: imageBase64,
                  },
                },
                {
                  type: "text",
                  text: prompt,
                },
              ],
            },
          ],
        }),
      });

      if (claudeResponse.ok) {
        claudeJson = (await claudeResponse.json()) as ClaudeMessageResponse;
        break;
      }

      lastErrorBody = await claudeResponse.text();
      console.log("[bill-extract] model failed", { model, details: lastErrorBody });

      const parsedError = (() => {
        try {
          return JSON.parse(lastErrorBody) as ClaudeErrorPayload;
        } catch {
          return null;
        }
      })();

      const isModelNotFound = parsedError?.error?.type === "not_found_error";
      if (!isModelNotFound) {
        break;
      }
    }

    if (!claudeJson) {
      return NextResponse.json(
        { error: "Claude API request failed.", details: lastErrorBody },
        { status: 502 },
      );
    }
    const outputText =
      claudeJson.content?.find((block) => block.type === "text")?.text ?? "";

    const parsed = extractJsonObject(outputText);
    const normalized = normalizeExtraction(parsed);

    return NextResponse.json(normalized);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal extraction error." },
      { status: 500 },
    );
  }
};
