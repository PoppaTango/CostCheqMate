// =============================================================================
// MODERATOR UTILITIES - Role hierarchy, permissions, and moderation constants
// This file provides utility functions and constants for the moderation system
// =============================================================================

// -----------------------------------------------------------------------------
// TYPE DEFINITIONS - TypeScript types for moderation system
// -----------------------------------------------------------------------------

/**
 * User roles in hierarchical order (highest to lowest)
 * - admin: Single application administrator with FULL control (cannot be demoted)
 * - superuser: Delegated administrators with nearly full powers (cannot demote admin)
 * - moderator: Staff who handle daily moderation tasks
 * - premium: Paying users with enhanced features
 * - free: Regular free users
 */
export type UserRole = 'admin' | 'superuser' | 'moderator' | 'premium' | 'free';

/**
 * User account status options
 * - active: Normal functioning account
 * - suspended: Temporarily restricted access
 * - banned: Account is banned from the platform
 * - pending: Awaiting verification or approval
 */
export type UserStatus = 'active' | 'suspended' | 'banned' | 'pending';

/**
 * Types of offenses that can lead to warnings or bans
 */
export type OffenseType = 
  | 'spam' 
  | 'abuse' 
  | 'fraud' 
  | 'terms_violation' 
  | 'inappropriate_content' 
  | 'harassment'
  | 'impersonation'
  | 'other';

/**
 * Types of moderator actions that get logged
 */
export type ModeratorActionType = 
  | 'role_change' 
  | 'status_change' 
  | 'cheqs_edit' 
  | 'ban_issue' 
  | 'ban_revoke' 
  | 'account_edit' 
  | 'warning_issue'
  | 'account_type_change'
  | 'note_add'
  | 'verification_change'
  | 'report_review';

/**
 * Warning types with increasing severity
 */
export type WarningType = 'verbal' | 'written' | 'final';

/**
 * Note categories for internal staff notes
 */
export type NoteCategory = 'general' | 'support' | 'payment' | 'behavior' | 'other';

/**
 * Report priority levels
 */
export type ReportPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Report status options
 */
export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

// -----------------------------------------------------------------------------
// ROLE HIERARCHY - Defines permission levels for each role
// Higher number = more permissions
// -----------------------------------------------------------------------------

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  free: 0,        // Free users (lowest level)
  premium: 1,     // Premium paying users
  moderator: 2,   // Staff handling daily moderation tasks
  superuser: 3,   // Delegated admins with most powers
  admin: 4,       // Single application administrator (root, highest level)
};

/** Email addresses protected as Admin (cannot be demoted) */
export const ADMIN_EMAILS = [
  'dylan.prysazniuk@outlook.com',
  'paymaantehrani@hotmail.com',
];

/** 
 * Super Admin email - has authority to manage ALL users including other admins 
 * Only Paymaan Tehrani has this elevated permission
 */
export const SUPER_ADMIN_EMAIL = 'paymaantehrani@hotmail.com';

/**
 * Check if an email is the super admin (can manage everyone including admins)
 * @param email - Email to check
 * @returns true if this is the super admin email
 */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

// -----------------------------------------------------------------------------
// PERMISSION CHECKING FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Check if an email is a protected admin email
 * @param email - Email to check
 * @returns true if this email belongs to the root admin
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Check if a user has moderator-level access or higher
 * @param role - The user's role to check
 * @returns true if user can perform moderation tasks
 */
export function canModerate(role: string): boolean {
  // Moderators, superusers, and admins can all moderate
  return ['moderator', 'superuser', 'admin'].includes(role);
}

/**
 * Check if a user has superuser-level access or higher
 * @param role - The user's role to check
 * @returns true if user has superuser or admin privileges
 */
export function isSuperUser(role: string): boolean {
  return ['superuser', 'admin'].includes(role);
}

/**
 * Check if a user is the application administrator (root level)
 * @param role - The user's role to check
 * @returns true if user is the admin
 */
export function isAdmin(role: string): boolean {
  return role === 'admin';
}

/**
 * Legacy function - kept for compatibility (maps to admin)
 */
export function isOwner(role: string): boolean {
  return role === 'admin';
}

/**
 * Check if a user can manage another user based on role hierarchy
 * Admin cannot be managed by anyone except themselves or the super admin
 * @param performerRole - Role of the user performing the action
 * @param targetRole - Role of the user being managed
 * @param targetEmail - Email of the target user (for admin protection)
 * @param performerEmail - Email of the user performing the action (for super admin check)
 * @returns true if performer can manage target
 */
export function canManageUser(
  performerRole: string, 
  targetRole: string, 
  targetEmail?: string,
  performerEmail?: string
): boolean {
  // Super admin (Paymaan Tehrani) can manage EVERYONE including other admins
  if (performerEmail && isSuperAdminEmail(performerEmail)) {
    return true;
  }
  
  // Admin emails are protected - only admin can manage admin
  if (targetEmail && isAdminEmail(targetEmail)) {
    return performerRole === 'admin';
  }
  
  // Get hierarchy levels for both roles (default to 0 if unknown)
  const performerLevel = ROLE_HIERARCHY[performerRole as UserRole] ?? 0;
  const targetLevel = ROLE_HIERARCHY[targetRole as UserRole] ?? 0;
  
  // Can only manage users with strictly lower role level
  return performerLevel > targetLevel;
}

/**
 * Check if a role change is allowed based on hierarchy
 * Admin role cannot be assigned to non-admin emails
 * SuperUsers cannot demote admin (but super admin can)
 * @param performerRole - Role of user making the change
 * @param targetCurrentRole - Target user's current role
 * @param targetNewRole - Desired new role for target
 * @param targetEmail - Target user's email (for admin protection)
 * @param performerEmail - Email of the user performing the action (for super admin check)
 * @returns true if the role change is allowed
 */
export function canChangeRole(
  performerRole: string, 
  targetCurrentRole: string, 
  targetNewRole: string,
  targetEmail?: string,
  performerEmail?: string
): boolean {
  // Super admin (Paymaan Tehrani) can change ANY role for ANY user
  if (performerEmail && isSuperAdminEmail(performerEmail)) {
    // Only admin emails can be given admin role
    if (targetNewRole === 'admin' && targetEmail && !isAdminEmail(targetEmail)) {
      return false;
    }
    return true;
  }
  
  // Protect admin emails - they cannot be demoted below admin (except by super admin)
  if (targetEmail && isAdminEmail(targetEmail) && targetNewRole !== 'admin') {
    return false;
  }
  
  // Only admin emails can be given admin role
  if (targetNewRole === 'admin' && targetEmail && !isAdminEmail(targetEmail)) {
    return false;
  }
  
  // Get hierarchy levels
  const performerLevel = ROLE_HIERARCHY[performerRole as UserRole] ?? 0;
  const currentLevel = ROLE_HIERARCHY[targetCurrentRole as UserRole] ?? 0;
  const newLevel = ROLE_HIERARCHY[targetNewRole as UserRole] ?? 0;
  
  // SuperUsers can't promote to or demote from admin
  if (performerRole === 'superuser') {
    if (targetCurrentRole === 'admin' || targetNewRole === 'admin') {
      return false;
    }
  }
  
  // Can only change roles of users at or below you, and can't promote to your level or above
  return performerLevel > currentLevel && performerLevel > newLevel;
}

/**
 * Get the list of roles a user can assign to others
 * @param performerRole - The role of the user assigning
 * @returns Array of roles that can be assigned
 */
export function getAssignableRoles(performerRole: string): UserRole[] {
  const level = ROLE_HIERARCHY[performerRole as UserRole] ?? 0;
  
  // Return all roles below the performer's level (never include admin for non-admins)
  return (Object.entries(ROLE_HIERARCHY) as [UserRole, number][])
    .filter(([role, roleLevel]) => {
      // Never let superusers assign admin role
      if (role === 'admin' && performerRole !== 'admin') return false;
      return roleLevel < level;
    })
    .map(([role]) => role);
}

/**
 * Check if a user can grant audit trail access to another user
 * Only Admin and SuperUsers with canViewAuditTrail can do this
 */
export function canGrantAuditAccess(role: string): boolean {
  return role === 'admin';
}

/**
 * Check if a user can delete another user
 * Only administrators can delete users
 * Admins cannot delete other admin emails (except super admin)
 * @param performerRole - Role of the user performing the deletion
 * @param targetRole - Role of the user being deleted
 * @param targetEmail - Email of the user being deleted
 * @param performerEmail - Email of the user performing the deletion
 * @returns true if the deletion is allowed
 */
export function canDeleteUser(
  performerRole: string,
  targetRole: string,
  targetEmail?: string,
  performerEmail?: string
): boolean {
  // Only admins can delete users
  if (performerRole !== 'admin') {
    return false;
  }
  
  // Super admin can delete anyone except themselves
  if (performerEmail && isSuperAdminEmail(performerEmail)) {
    // Cannot delete yourself
    if (targetEmail && targetEmail.toLowerCase() === performerEmail.toLowerCase()) {
      return false;
    }
    return true;
  }
  
  // Regular admins cannot delete admin emails
  if (targetEmail && isAdminEmail(targetEmail)) {
    return false;
  }
  
  // Admins can delete non-admin users
  return true;
}

// -----------------------------------------------------------------------------
// HUMAN-READABLE LABELS - For displaying in the UI
// -----------------------------------------------------------------------------

/** Labels for offense types */
export const OFFENSE_LABELS: Record<OffenseType, string> = {
  spam: 'Spam or Unwanted Content',
  abuse: 'Abusive Behavior',
  fraud: 'Fraudulent Activity',
  terms_violation: 'Terms of Service Violation',
  inappropriate_content: 'Inappropriate Content',
  harassment: 'Harassment or Bullying',
  impersonation: 'Impersonation',
  other: 'Other',
};

/** Labels for user statuses */
export const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  banned: 'Banned',
  pending: 'Pending Verification',
};

/** Labels for user roles */
export const ROLE_LABELS: Record<UserRole, string> = {
  free: 'Free User',
  premium: 'Premium User',
  moderator: 'Moderator',
  superuser: 'Super User',
  admin: 'Administrator',
};

/** Descriptions for each role */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  free: 'Free user with basic access to the platform',
  premium: 'Premium paying user with enhanced features',
  moderator: 'Staff member who handles daily moderation tasks',
  superuser: 'Delegated administrator with elevated powers',
  admin: 'Application administrator with full control',
};

/** Labels for warning types */
export const WARNING_LABELS: Record<WarningType, string> = {
  verbal: 'Verbal Warning',
  written: 'Written Warning',
  final: 'Final Warning',
};

/** Labels for note categories */
export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  general: 'General',
  support: 'Support Issue',
  payment: 'Payment Related',
  behavior: 'User Behavior',
  other: 'Other',
};

/** Labels for report priorities */
export const PRIORITY_LABELS: Record<ReportPriority, string> = {
  low: 'Low Priority',
  normal: 'Normal Priority',
  high: 'High Priority',
  urgent: 'Urgent',
};

/** Labels for report statuses */
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Pending Review',
  reviewing: 'Under Review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

/** Labels for moderator action types */
export const ACTION_LABELS: Record<ModeratorActionType, string> = {
  role_change: 'Role Changed',
  status_change: 'Status Changed',
  cheqs_edit: 'Cheqs Modified',
  ban_issue: 'Ban Issued',
  ban_revoke: 'Ban Revoked',
  account_edit: 'Account Edited',
  warning_issue: 'Warning Issued',
  account_type_change: 'Account Type Changed',
  note_add: 'Note Added',
  verification_change: 'Verification Status Changed',
  report_review: 'Report Reviewed',
};

// -----------------------------------------------------------------------------
// BAN DURATION OPTIONS - Pre-defined ban lengths
// -----------------------------------------------------------------------------

export const BAN_DURATION_OPTIONS = [
  { value: '1_hour', label: '1 Hour', hours: 1 },
  { value: '6_hours', label: '6 Hours', hours: 6 },
  { value: '12_hours', label: '12 Hours', hours: 12 },
  { value: '24_hours', label: '24 Hours', hours: 24 },
  { value: '3_days', label: '3 Days', hours: 72 },
  { value: '7_days', label: '7 Days', hours: 168 },
  { value: '14_days', label: '14 Days', hours: 336 },
  { value: '30_days', label: '30 Days', hours: 720 },
  { value: '90_days', label: '90 Days', hours: 2160 },
  { value: '6_months', label: '6 Months', hours: 4320 },
  { value: '1_year', label: '1 Year', hours: 8760 },
  { value: 'permanent', label: 'Permanent', hours: null },
];

/**
 * Calculate the end date for a ban based on duration selection
 * @param durationValue - The selected duration value
 * @returns Date object for when ban ends, or null for permanent
 */
export function calculateBanEndDate(durationValue: string): Date | null {
  // Find the matching duration option
  const option = BAN_DURATION_OPTIONS.find(o => o.value === durationValue);
  
  // Return null for permanent bans or unknown durations
  if (!option || option.hours === null) return null;
  
  // Calculate end date by adding hours to current time
  const endDate = new Date();
  endDate.setHours(endDate.getHours() + option.hours);
  return endDate;
}

// -----------------------------------------------------------------------------
// WARNING SEVERITY OPTIONS
// -----------------------------------------------------------------------------

export const WARNING_SEVERITY_OPTIONS = [
  { value: 1, label: 'Level 1 - Minor', description: 'First offense, minor issue' },
  { value: 2, label: 'Level 2 - Low', description: 'Repeated minor offense' },
  { value: 3, label: 'Level 3 - Medium', description: 'Significant violation' },
  { value: 4, label: 'Level 4 - High', description: 'Serious violation' },
  { value: 5, label: 'Level 5 - Severe', description: 'Major violation, near-ban' },
];

// -----------------------------------------------------------------------------
// UTILITY FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Get a color class for a user status badge
 * @param status - The user status
 * @returns Tailwind CSS classes for styling
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-600 border-green-500/30',
    suspended: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
    banned: 'bg-red-500/10 text-red-600 border-red-500/30',
    pending: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  };
  return colors[status] || 'bg-gray-500/10 text-gray-600 border-gray-500/30';
}

/**
 * Get a color class for a user role badge
 * @param role - The user role
 * @returns Tailwind CSS classes for styling
 */
export function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    free: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
    premium: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    moderator: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
    superuser: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    admin: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
  };
  return colors[role] || 'bg-gray-500/10 text-gray-600 border-gray-500/30';
}

/**
 * Get a color class for report priority
 * @param priority - The priority level
 * @returns Tailwind CSS classes for styling
 */
export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: 'bg-gray-500/10 text-gray-600 border-gray-500/30',
    normal: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    high: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
    urgent: 'bg-red-500/10 text-red-600 border-red-500/30',
  };
  return colors[priority] || 'bg-gray-500/10 text-gray-600 border-gray-500/30';
}

/**
 * Format a date string for display
 * @param dateString - ISO date string to format
 * @returns Formatted date string
 */
export function formatModDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get the time remaining until a ban expires
 * @param endDate - The ban end date
 * @returns Human-readable time remaining string
 */
export function getBanTimeRemaining(endDate: string | null): string {
  // Permanent bans have no end date
  if (!endDate) return 'Permanent';
  
  const end = new Date(endDate);
  const now = new Date();
  
  // Check if ban has already expired
  if (end <= now) return 'Expired';
  
  // Calculate difference in milliseconds
  const diff = end.getTime() - now.getTime();
  
  // Convert to appropriate units
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} remaining`;
  }
  
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} remaining`;
  }
  
  const minutes = Math.floor(diff / (1000 * 60));
  return `${minutes} minute${minutes > 1 ? 's' : ''} remaining`;
}
