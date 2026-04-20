// =============================================================================
// DATA EXPORT API - Export financial data for Power BI and other BI tools
// Premium feature - allows users to export their data via API
// =============================================================================

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { evaluatePremiumFeatureAccess } from "@/lib/premium-trial";

/**
 * GET /api/export
 * Export user's financial data
 * Query params:
 * - format: 'json' (default) or 'csv'
 * - type: 'expenses', 'categories', 'budget', 'income', or 'all'
 * - startDate: Filter start date (ISO string)
 * - endDate: Filter end date (ISO string)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is business/premium-capable role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { accountType: true, role: true },
    });

    // Allow business users, moderators, superusers, and admins
    const hasAccess = user && (
      user.accountType === 'business' || 
      ['moderator', 'superuser', 'admin'].includes(user.role)
    );

    if (!hasAccess) {
      const trialDecision = await evaluatePremiumFeatureAccess({
        userId: session.user.id,
        actionType: "export_api_access",
        consume: true,
        metadata: { endpoint: "GET /api/export" },
      });
      if (!trialDecision.allowed) {
        return NextResponse.json(
          {
            error:
              "Data export requires Business or Premium trial quota. Free accounts get 10 Premium actions per month.",
            upgradeRequired: true,
            requiredPlan: "business",
            premiumTrial: trialDecision.status,
          },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json';
    const type = searchParams.get('type') || 'all';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date filter
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    // Collect requested data
    const exportData: Record<string, unknown> = {
      exportDate: new Date().toISOString(),
      userId: session.user.id,
    };

    // Expenses
    if (type === 'expenses' || type === 'all') {
      const expenses = await prisma.expense.findMany({
        where: {
          userId: session.user.id,
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        },
        include: {
          category: {
            select: { name: true, icon: true, color: true },
          },
        },
        orderBy: { date: 'desc' },
      });

      exportData.expenses = expenses.map(e => ({
        id: e.id,
        amount: e.amount,
        merchant: e.merchant,
        description: e.description,
        date: e.date.toISOString(),
        categoryName: e.category?.name,
        categoryIcon: e.category?.icon,
        createdAt: e.createdAt.toISOString(),
      }));
    }

    // Categories & Budget
    if (type === 'categories' || type === 'budget' || type === 'all') {
      const categories = await prisma.category.findMany({
        where: { userId: session.user.id },
        include: {
          expenses: {
            where: Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {},
            select: { amount: true },
          },
        },
      });

      exportData.categories = categories.map(c => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        annualBudget: c.annualBudget,
        totalSpent: c.expenses.reduce((sum, e) => sum + e.amount, 0),
        remaining: c.annualBudget - c.expenses.reduce((sum, e) => sum + e.amount, 0),
        expenseCount: c.expenses.length,
      }));
    }

    // Income settings
    if (type === 'income' || type === 'all') {
      const income = await prisma.incomeSetting.findUnique({
        where: { userId: session.user.id },
      });

      const additionalIncome = await prisma.additionalIncome.findMany({
        where: {
          userId: session.user.id,
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        },
        orderBy: { date: 'desc' },
      });

      exportData.income = {
        netAmountPerPay: income?.netAmountPerPay || 0,
        frequency: income?.frequency || 'bi-weekly',
        firstPayDate: income?.firstPayDate?.toISOString() || null,
      };

      exportData.additionalIncome = additionalIncome.map(i => ({
        id: i.id,
        amount: i.amount,
        source: i.source,
        description: i.description,
        date: i.date.toISOString(),
      }));
    }

    // Summary statistics
    if (type === 'all') {
      const expenseArray = exportData.expenses as Array<{ amount: number }> || [];
      const categoryArray = exportData.categories as Array<{ annualBudget: number; totalSpent: number }> || [];
      
      exportData.summary = {
        totalExpenses: expenseArray.reduce((sum, e) => sum + e.amount, 0),
        expenseCount: expenseArray.length,
        totalBudget: categoryArray.reduce((sum, c) => sum + c.annualBudget, 0),
        totalSpent: categoryArray.reduce((sum, c) => sum + c.totalSpent, 0),
        categoryCount: categoryArray.length,
      };
    }

    // Return based on format
    if (format === 'csv') {
      // For CSV, we'll export expenses as the primary data
      const expenses = exportData.expenses as Array<Record<string, unknown>> || [];
      
      if (expenses.length === 0) {
        return new Response('No data to export', {
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      const headers = Object.keys(expenses[0]);
      const rows = expenses.map(row => 
        headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="cost-cheqmate-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Default: JSON
    return NextResponse.json(exportData);
  } catch (error) {
    console.error("Export data error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/export/api-key
 * Generate or regenerate API key for external access (Premium only)
 * This would allow users to access their data from Power BI
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check premium access
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { accountType: true, role: true },
    });

    const hasAccess = user && (
      user.accountType === 'premium' || 
      ['moderator', 'superuser', 'admin'].includes(user.role)
    );

    if (!hasAccess) {
      const trialDecision = await evaluatePremiumFeatureAccess({
        userId: session.user.id,
        actionType: "export_api_access",
        consume: true,
        metadata: { endpoint: "POST /api/export" },
      });
      if (!trialDecision.allowed) {
        return NextResponse.json(
          {
            error:
              "API access is a Premium feature. Free accounts get 10 Premium actions per month.",
            upgradeRequired: true,
            requiredPlan: "premium",
            premiumTrial: trialDecision.status,
          },
          { status: 403 }
        );
      }
    }

    // For now, return instructions on how to use the API
    // In a full implementation, you'd generate an API key here
    return NextResponse.json({
      message: "API Access Instructions",
      instructions: {
        endpoint: "/api/export",
        method: "GET",
        authentication: "Session-based (must be logged in)",
        parameters: {
          format: "'json' or 'csv'",
          type: "'expenses', 'categories', 'budget', 'income', or 'all'",
          startDate: "ISO date string (optional)",
          endDate: "ISO date string (optional)",
        },
        powerBiIntegration: {
          step1: "In Power BI Desktop, select 'Get Data' > 'Web'",
          step2: "Enter the API URL with your desired parameters",
          step3: "For authentication, you'll need to use browser session (logged in)",
          step4: "Transform and load your data as needed",
          note: "For automated refresh, consider exporting to CSV and using Power BI's file connector",
        },
      },
    });
  } catch (error) {
    console.error("Export API info error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
