import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://steward-money.vercel.app";

export async function POST(req: NextRequest) {
  const { email, name } = await req.json() as { email?: string; name?: string };
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    // Welcome email skipped — RESEND_API_KEY not configured
    console.log("[welcome] RESEND_API_KEY not set — skipping welcome email for", email);
    return NextResponse.json({ skipped: true });
  }

  const displayName = name ?? email.split("@")[0] ?? "there";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:40px 24px;background:#0a0a12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e0e0f0;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="margin-bottom:32px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;background:#7857ff;border-radius:12px;">
        <span style="color:#fff;font-size:22px;font-weight:900;letter-spacing:-1px;">S</span>
      </div>
    </div>

    <p style="font-size:16px;line-height:1.6;color:#c0c0d8;margin:0 0 20px;">Hey ${displayName},</p>

    <p style="font-size:16px;line-height:1.6;color:#c0c0d8;margin:0 0 16px;">
      I'm Luka — your financial co-pilot at Steward Money.
    </p>
    <p style="font-size:16px;line-height:1.6;color:#c0c0d8;margin:0 0 28px;">
      I'm not a chatbot. I'm here to help you steward your money with intention. Connect your bank, set your goals, and I'll watch over things so you don't have to.
    </p>

    <div style="background:#13131f;border:1px solid #2a2a3a;border-radius:12px;padding:24px;margin-bottom:28px;">
      <p style="margin:0 0 16px;font-size:13px;font-weight:600;letter-spacing:0.08em;color:#7857ff;text-transform:uppercase;">What to expect</p>
      <div style="margin-bottom:14px;">
        <p style="margin:0;font-size:14px;font-weight:600;color:#e0e0f0;">Day 1 —</p>
        <p style="margin:4px 0 0;font-size:14px;line-height:1.5;color:#8888a0;">We'll get to know your situation. Income, bills, who you are.</p>
      </div>
      <div style="margin-bottom:14px;">
        <p style="margin:0;font-size:14px;font-weight:600;color:#e0e0f0;">Day 7 —</p>
        <p style="margin:4px 0 0;font-size:14px;line-height:1.5;color:#8888a0;">Your first weekly review. I'll show you where you've been generous, where you've leaked, and what's coming up.</p>
      </div>
      <div>
        <p style="margin:0;font-size:14px;font-weight:600;color:#e0e0f0;">Day 30 —</p>
        <p style="margin:4px 0 0;font-size:14px;line-height:1.5;color:#8888a0;">Your first stewardship score. A simple look at how you've been faithful with what you've been given.</p>
      </div>
    </div>

    <p style="font-size:16px;line-height:1.6;color:#c0c0d8;margin:0 0 8px;">
      You don't have to be good with money. You just have to be honest with me.
    </p>
    <p style="font-size:16px;line-height:1.6;color:#c0c0d8;margin:0 0 32px;">
      Open the app whenever. I'm always here.
    </p>

    <a href="${APP_URL}" style="display:inline-block;background:#7857ff;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;">
      Open Steward Money
    </a>

    <p style="margin:40px 0 0;font-size:13px;color:#555570;">— Luka</p>
    <p style="margin:4px 0 0;font-size:12px;color:#3a3a50;">Steward Money · Your money, with intention</p>
  </div>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Luka at Steward Money <hello@stewardmoney.com>",
        to: [email],
        subject: "Welcome to Steward Money — let's get started",
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[welcome] Resend error:", err);
      return NextResponse.json({ error: "email send failed" }, { status: 500 });
    }
    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("[welcome] fetch error:", err);
    return NextResponse.json({ error: "email send failed" }, { status: 500 });
  }
}
