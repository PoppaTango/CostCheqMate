export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CHEQ_REWARDS } from "@/lib/cheqs";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reports = await prisma.bugReport.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(reports);
  } catch (error) {
    console.error("Error fetching bug reports:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      description,
      severity,
      page,
      stepsToReproduce,
      expectedBehavior,
      actualBehavior,
    } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: "Title and description are required" },
        { status: 400 }
      );
    }

    // Calculate cheqs reward based on severity
    let cheqsReward = CHEQ_REWARDS.BUG_REPORT_MEDIUM;
    switch (severity) {
      case "low":
        cheqsReward = CHEQ_REWARDS.BUG_REPORT_LOW;
        break;
      case "high":
        cheqsReward = CHEQ_REWARDS.BUG_REPORT_HIGH;
        break;
      case "critical":
        cheqsReward = CHEQ_REWARDS.BUG_REPORT_CRITICAL;
        break;
    }

    // Create bug report
    const report = await prisma.bugReport.create({
      data: {
        title,
        description,
        severity: severity || "medium",
        page,
        stepsToReproduce,
        expectedBehavior,
        actualBehavior,
        cheqsRewarded: cheqsReward,
        userId: session.user.id,
      },
    });

    // Award cheqs to user
    await prisma.user.update({
      where: { id: session.user.id },
      data: { cheqs: { increment: cheqsReward } },
    });

    // Get user info for email
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true },
    });

    // Send email notification
    try {
      const appUrl = process.env.NEXTAUTH_URL || 'https://costcheqmate.com';
      const appName = 'Cost CheqMate';
      
      // Create Deep Agent prompt
      const deepAgentPrompt = `Fix the following bug in Cost CheqMate:\n\n**Bug Title:** ${title}\n**Severity:** ${severity || 'medium'}\n**Page/Module:** ${page || 'Not specified'}\n**Description:** ${description}\n${stepsToReproduce ? `**Steps to Reproduce:**\n${stepsToReproduce}` : ''}\n${expectedBehavior ? `**Expected Behavior:** ${expectedBehavior}` : ''}\n${actualBehavior ? `**Actual Behavior:** ${actualBehavior}` : ''}\n\nPlease investigate and fix this issue.`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
          <h2 style="color: #00d4aa; border-bottom: 2px solid #00d4aa; padding-bottom: 10px;">
            🐛 New Bug Report Submitted
          </h2>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #333;">${title}</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Reporter:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${user?.name || 'Unknown'} (${user?.email || 'N/A'})</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Severity:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                  <span style="background: ${severity === 'critical' ? '#dc2626' : severity === 'high' ? '#ea580c' : severity === 'low' ? '#16a34a' : '#ca8a04'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${severity || 'medium'}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Page/Module:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${page || 'Not specified'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Cheqs Rewarded:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">🪙 ${cheqsReward} Cheqs</td>
              </tr>
            </table>
            
            <div style="margin-top: 20px;">
              <p style="margin: 10px 0;"><strong>Description:</strong></p>
              <div style="background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #00d4aa;">
                ${description}
              </div>
            </div>
            
            ${stepsToReproduce ? `
            <div style="margin-top: 15px;">
              <p style="margin: 10px 0;"><strong>Steps to Reproduce:</strong></p>
              <div style="background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #6366f1;">
                ${stepsToReproduce.replace(/\n/g, '<br>')}
              </div>
            </div>
            ` : ''}
            
            ${expectedBehavior ? `
            <div style="margin-top: 15px;">
              <p style="margin: 10px 0;"><strong>Expected Behavior:</strong></p>
              <div style="background: #ecfdf5; padding: 15px; border-radius: 4px;">${expectedBehavior}</div>
            </div>
            ` : ''}
            
            ${actualBehavior ? `
            <div style="margin-top: 15px;">
              <p style="margin: 10px 0;"><strong>Actual Behavior:</strong></p>
              <div style="background: #fef2f2; padding: 15px; border-radius: 4px;">${actualBehavior}</div>
            </div>
            ` : ''}
          </div>
          
          <div style="background: #1e293b; color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #00d4aa;">📋 Deep Agent Prompt (Copy & Paste):</h4>
            <div style="background: #0f172a; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 13px; white-space: pre-wrap;">${deepAgentPrompt}</div>
          </div>
          
          <p style="color: #666; font-size: 12px;">
            Submitted at: ${new Date().toLocaleString()}<br>
            Report ID: ${report.id}
          </p>
        </div>
      `;

      await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deployment_token: process.env.ABACUSAI_API_KEY,
          app_id: process.env.WEB_APP_ID,
          notification_id: process.env.NOTIF_ID_BUG_REPORT_SUBMISSION,
          subject: `[${severity?.toUpperCase() || 'MEDIUM'}] Bug Report: ${title}`,
          body: htmlBody,
          is_html: true,
          recipient_email: 'support@costcheqmate.com',
          sender_email: `noreply@costcheqmate.com`,
          sender_alias: appName,
        }),
      });
    } catch (emailError) {
      console.error('Failed to send bug report email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      report,
      cheqsEarned: cheqsReward,
      message: `Bug report submitted! You earned ${cheqsReward} Cheqs.`,
    });
  } catch (error) {
    console.error("Error creating bug report:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
