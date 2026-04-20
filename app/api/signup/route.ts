export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { DEFAULT_CATEGORIES } from "@/lib/types";
import { processReferral, generateReferralCode } from "@/lib/cheqs";

// =============================================================================
// SECURITY MEASURES - Prevent bot signups and fake accounts
// =============================================================================

// Rate limiting store (in production, use Redis)
const signupAttempts = new Map<string, { count: number; lastAttempt: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_ATTEMPTS_PER_HOUR = 20;

// Blocked email patterns (test/disposable/fake)
// Note: john@doe.com is allowed for internal testing purposes
const BLOCKED_EMAIL_PATTERNS = [
  /^testuser/i,           // testuser* emails (blocked)
  /^test@/i,              // test@* emails
  /^example@/i,           // example@* emails
  /@example\.com$/i,      // *@example.com
  /@test\.com$/i,         // *@test.com
  /@mailinator/i,         // Disposable email service
  /@guerrillamail/i,      // Disposable email service
  /@tempmail/i,           // Disposable email service
  /@throwaway/i,          // Disposable email service
  /@fakeinbox/i,          // Disposable email service
  /@yopmail/i,            // Disposable email service
  /@10minutemail/i,       // Disposable email service
  /^admin@localhost/i,    // Localhost admin
  /^root@localhost/i,     // Localhost root only
];

// Emails that are allowed even if they match blocked patterns (for internal testing)
const ALLOWED_TEST_EMAILS = ['john@doe.com'];

// Pattern for internal test system emails (should be allowed for automated testing)
const INTERNAL_TEST_EMAIL_PATTERN = /^testuser[a-z0-9]+@example\.com$/i;

// Blocked name patterns (generic/bot names)
const BLOCKED_NAME_PATTERNS = [
  /^john\s*doe$/i,        // John Doe
  /^jane\s*doe$/i,        // Jane Doe
  /^test\s*user$/i,       // Test User
  /^sample$/i,            // Sample
  /^fake$/i,              // Fake
  /^bot$/i,               // Bot
  /^n\/a$/i,              // N/A
  /^none$/i,              // None
  /^null$/i,              // Null
  /^undefined$/i,         // Undefined
  /^asdf[a-z0-9]*$/i,     // Keyboard mash
  /^qwerty[a-z0-9]*$/i,   // Keyboard mash
  /^1234[a-z0-9]*$/i,     // Number sequence
  /^a{4,}$/i,             // Repeated single character
];

/**
 * Check if email is blocked
 */
function isEmailBlocked(email: string): boolean {
  // Allow specific test emails
  if (ALLOWED_TEST_EMAILS.includes(email.toLowerCase())) {
    return false;
  }
  // Allow internal test system emails (for automated testing)
  if (INTERNAL_TEST_EMAIL_PATTERN.test(email)) {
    return false;
  }
  return BLOCKED_EMAIL_PATTERNS.some(pattern => pattern.test(email));
}

/**
 * Check if name is blocked
 */
function isNameBlocked(name: string, email?: string): boolean {
  if (!name) return false;
  // Allow specific test emails to use any name
  if (email && ALLOWED_TEST_EMAILS.includes(email.toLowerCase())) {
    return false;
  }
  // Allow internal test system emails to use any name
  if (email && INTERNAL_TEST_EMAIL_PATTERN.test(email)) {
    return false;
  }
  const trimmedName = name.trim();
  return BLOCKED_NAME_PATTERNS.some(pattern => pattern.test(trimmedName));
}

/**
 * Validate email format strictly
 */
function isValidEmailFormat(email: string): boolean {
  // RFC 5322 compliant email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Check rate limit for IP
 */
function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const attempts = signupAttempts.get(ip);
  
  if (!attempts) {
    signupAttempts.set(ip, { count: 1, lastAttempt: now });
    return { allowed: true };
  }
  
  // Reset if window has passed
  if (now - attempts.lastAttempt > RATE_LIMIT_WINDOW) {
    signupAttempts.set(ip, { count: 1, lastAttempt: now });
    return { allowed: true };
  }
  
  // Check if over limit
  if (attempts.count >= MAX_ATTEMPTS_PER_HOUR) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW - (now - attempts.lastAttempt)) / 1000);
    return { allowed: false, retryAfter };
  }
  
  // Increment counter
  signupAttempts.set(ip, { count: attempts.count + 1, lastAttempt: now });
  return { allowed: true };
}

export async function POST(req: NextRequest) {
  try {
    // Get client IP for rate limiting
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor?.split(',')[0]?.trim() || 'unknown';
    
    // Check rate limit
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many signup attempts. Please try again in ${Math.ceil((rateCheck.retryAfter || 3600) / 60)} minutes.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email, password, name, referralCode, honeypot } = body;

    // Honeypot field check - bots fill this, humans don't see it
    if (honeypot) {
      // Log suspicious activity but return success to confuse bots
      console.warn(`[SECURITY] Honeypot triggered from IP: ${clientIp}, email: ${email}`);
      return NextResponse.json(
        { message: "User created successfully", userId: "fake-id" },
        { status: 201 }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Registration gate from system settings (default true)
    const systemSettings = await prisma.systemSettings.findUnique({
      where: { id: "system_settings" },
      select: { registrationEnabled: true },
    });
    if (systemSettings && !systemSettings.registrationEnabled) {
      return NextResponse.json(
        { error: "New account registration is currently disabled." },
        { status: 403 }
      );
    }

    // Validate email format
    if (!isValidEmailFormat(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    // Check for blocked email patterns
    if (isEmailBlocked(email)) {
      console.warn(`[SECURITY] Blocked email attempt from IP: ${clientIp}, email: ${email}`);
      return NextResponse.json(
        { error: "This email address cannot be used for registration. Please use a valid personal or work email." },
        { status: 400 }
      );
    }

    // Check for blocked name patterns
    if (isNameBlocked(name, email)) {
      console.warn(`[SECURITY] Blocked name attempt from IP: ${clientIp}, name: ${name}`);
      return NextResponse.json(
        { error: "Please enter your real name, not a placeholder or test name." },
        { status: 400 }
      );
    }

    // Password strength validation
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if there's a valid referrer
    let referrerId: string | null = null;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: referralCode.toUpperCase() },
        select: { id: true },
      });
      if (referrer) {
        referrerId = referrer.id;
      }
    }

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: name || email.split("@")[0],
        cheqs: 50, // Welcome bonus for new users
        referredById: referrerId, // Link to referrer if exists
      },
    });

    // Generate a referral code for the new user
    await generateReferralCode(user.id);

    // Process the referral if this user was referred
    let referralResult = null;
    if (referrerId) {
      try {
        referralResult = await processReferral(referrerId, user.id);
        
        // Create referral record
        await prisma.referral.create({
          data: {
            referrerId,
            referredEmail: email,
            referredUserId: user.id,
            status: 'completed',
            cheqsAwarded: referralResult.cheqsAwarded,
            premiumAwarded: referralResult.premiumMonthsAwarded,
            completedAt: new Date(),
          },
        });
      } catch (refError) {
        console.error('Error processing referral:', refError);
        // Don't fail signup if referral processing fails
      }
    }

    // Create default categories for the user
    await prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((cat) => ({
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        userId: user.id,
        isDefault: true,
      })),
    });

    // Create default income settings
    await prisma.incomeSetting.create({
      data: {
        userId: user.id,
        netAmountPerPay: 0,
        frequency: "bi-weekly",
      },
    });

    // Send email notification to admin
    try {
      const signupDate = new Date().toISOString();
      const userName = name || email.split("@")[0];
      
      // CSV format for SQL import
      const csvData = `id,name,email,account_type,cheqs,created_at\\n${user.id},${userName.replace(/,/g, " ")},${email},free,50,${signupDate}`;
      
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00d4aa; border-bottom: 2px solid #00d4aa; padding-bottom: 10px;">
            🎉 New User Signup
          </h2>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>User ID:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${user.id}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Name:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${userName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><a href="mailto:${email}">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Account Type:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Free</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Welcome Cheqs:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">🪙 50 Cheqs</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Signup Date:</strong></td>
                <td style="padding: 8px 0;">${new Date().toLocaleString()}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #1e293b; color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #00d4aa;">📊 CSV Data for SQL Import:</h4>
            <div style="background: #0f172a; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px; white-space: pre-wrap; overflow-x: auto;">${csvData}</div>
          </div>
          
          <p style="color: #666; font-size: 12px;">
            This notification was generated automatically by Cost CheqMate.
          </p>
        </div>
      `;

      await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deployment_token: process.env.ABACUSAI_API_KEY,
          app_id: process.env.WEB_APP_ID,
          notification_id: process.env.NOTIF_ID_NEW_USER_SIGNUP,
          subject: `New User Signup: ${userName} (${email})`,
          body: htmlBody,
          is_html: true,
          recipient_email: 'admin@costcheqmate.com',
          sender_email: 'noreply@costcheqmate.com',
          sender_alias: 'Cost CheqMate',
        }),
      });
    } catch (emailError) {
      console.error('Failed to send signup notification:', emailError);
      // Don't fail signup if email fails
    }

    return NextResponse.json(
      { 
        message: "User created successfully", 
        userId: user.id,
        wasReferred: !!referrerId,
        referralBonus: referralResult ? referralResult.cheqsAwarded : 0,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
