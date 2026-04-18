// =============================================================================
// NOTIFICATION UTILITIES - Functions for sending email notifications
// This file provides utility functions for the notification system
// =============================================================================

import { ROLE_LABELS, UserRole } from '@/lib/moderator';

/**
 * Send a notification email via the Abacus notification API
 * @param notificationId - The notification type ID from env vars
 * @param recipientEmail - Email address of the recipient
 * @param subject - Email subject line
 * @param htmlContent - HTML content of the email
 * @param metadata - Optional additional data
 */
export async function sendNotificationEmail(
  notificationId: string,
  recipientEmail: string,
  subject: string,
  htmlContent: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  try {
    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: notificationId,
        recipient: recipientEmail,
        subject,
        html: htmlContent,
        ...metadata,
      }),
    });

    if (!response.ok) {
      console.error('Failed to send notification email:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending notification email:', error);
    return false;
  }
}

/**
 * Generate exciting HTML email content for role upgrade notification
 * @param userName - User's name
 * @param newRole - The new role they've been upgraded to
 * @param upgraderName - Name of the person who upgraded them (optional)
 * @returns HTML string for the email
 */
export function generateRoleUpgradeEmail(
  userName: string,
  newRole: UserRole,
  upgraderName?: string
): { subject: string; html: string } {
  const roleLabel = ROLE_LABELS[newRole] || newRole;
  
  // Role-specific benefits and excitement
  const roleBenefits: Record<string, string[]> = {
    premium: [
      '🚀 1.5x Cheqs multiplier on all activities!',
      '📊 Export your data to CSV and Power BI',
      '📈 Advanced analytics and reporting',
      '🎯 Unlimited expense categories',
      '⭐ Priority support and features',
    ],
    moderator: [
      '🛡️ Access to moderation tools',
      '👥 Help manage the community',
      '📋 View user reports and feedback',
      '✨ All Premium features included!',
      '🏆 Special Moderator badge',
    ],
    superuser: [
      '👑 Nearly full administrative powers!',
      '📊 Access to audit trails (if granted)',
      '👥 Manage users and moderators',
      '⚙️ Configure system settings',
      '🎖️ Exclusive Super User status!',
    ],
    admin: [
      '🏅 FULL administrative control',
      '🔐 Complete access to all features',
      '📈 Full audit trail visibility',
      '⚙️ System configuration powers',
      '👑 The highest honor in Cost CheqMate!',
    ],
  };

  const benefits = roleBenefits[newRole] || ['🎉 Exciting new features await!'];

  const subject = `🎉 Congratulations! You've been upgraded to ${roleLabel}!`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.5);">
          <!-- Header with confetti effect -->
          <tr>
            <td style="padding: 40px; text-align: center; background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #d946ef 100%);">
              <h1 style="margin: 0; font-size: 48px;">🎉🎊🎉</h1>
              <h1 style="margin: 20px 0 0; color: white; font-size: 28px; font-weight: bold; text-shadow: 0 2px 10px rgba(0,0,0,0.3);">
                CONGRATULATIONS!
              </h1>
            </td>
          </tr>
          
          <!-- Main content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #e2e8f0; font-size: 18px; margin: 0 0 20px; line-height: 1.6;">
                Hey <strong style="color: #22d3ee;">${userName || 'there'}</strong>! 🌟
              </p>
              
              <p style="color: #e2e8f0; font-size: 18px; margin: 0 0 20px; line-height: 1.6;">
                Amazing news! ${upgraderName ? `<strong style="color: #a78bfa;">${upgraderName}</strong> has just` : 'You\'ve been'} upgraded your account to:
              </p>
              
              <!-- Role badge -->
              <div style="text-align: center; margin: 30px 0;">
                <span style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%); color: white; font-size: 24px; font-weight: bold; padding: 15px 40px; border-radius: 50px; text-transform: uppercase; letter-spacing: 2px; box-shadow: 0 10px 30px rgba(6, 182, 212, 0.4);">
                  ✨ ${roleLabel} ✨
                </span>
              </div>
              
              <p style="color: #94a3b8; font-size: 16px; margin: 30px 0 20px; line-height: 1.6;">
                Here's what you can now do with your new powers:
              </p>
              
              <!-- Benefits list -->
              <ul style="list-style: none; padding: 0; margin: 0;">
                ${benefits.map(benefit => `
                  <li style="color: #e2e8f0; font-size: 16px; padding: 12px 20px; margin: 8px 0; background: rgba(255,255,255,0.05); border-radius: 8px; border-left: 4px solid #06b6d4;">
                    ${benefit}
                  </li>
                `).join('')}
              </ul>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 40px 0;">
                <a href="${process.env.NEXTAUTH_URL || 'https://costcheqmate.com'}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%); color: white; font-size: 18px; font-weight: bold; padding: 18px 50px; border-radius: 50px; text-decoration: none; box-shadow: 0 10px 30px rgba(6, 182, 212, 0.4); transition: transform 0.3s;">
                  🚀 Explore Your New Powers!
                </a>
              </div>
              
              <p style="color: #94a3b8; font-size: 14px; margin: 30px 0 0; line-height: 1.6; text-align: center;">
                We're thrilled to have you at this new level! If you have any questions about your new features, don't hesitate to reach out.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background: rgba(0,0,0,0.2); text-align: center;">
              <p style="color: #64748b; font-size: 14px; margin: 0;">
                💰 Cost CheqMate - Your Financial Companion
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return { subject, html };
}
