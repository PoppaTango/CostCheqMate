import { prisma } from "@/lib/db";

// =============================================================================
// CLOUD STORAGE INTEGRATION - OneDrive & Google Drive
// Handles OAuth flows, token refresh, folder creation, and file uploads
// =============================================================================

export type CloudProvider = "onedrive" | "googledrive";

const MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0";
const MICROSOFT_GRAPH_URL = "https://graph.microsoft.com/v1.0";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2";
const GOOGLE_API_URL = "https://www.googleapis.com";

const ROOT_FOLDER_NAME = "Cost CheqMate";

// =============================================================================
// OAuth URL Builders
// =============================================================================

function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL || "https://costcheqmate.com";
}

export function getOneDriveAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID || "",
    response_type: "code",
    redirect_uri: `${getBaseUrl()}/api/cloud-storage/callback/onedrive`,
    response_mode: "query",
    scope: "Files.ReadWrite offline_access User.Read",
    state,
  });
  return `${MICROSOFT_AUTH_URL}/authorize?${params.toString()}`;
}

export function getGoogleDriveAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    response_type: "code",
    redirect_uri: `${getBaseUrl()}/api/cloud-storage/callback/googledrive`,
    scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}/auth?${params.toString()}`;
}

// =============================================================================
// Token Exchange
// =============================================================================

export async function exchangeOneDriveCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(`${MICROSOFT_AUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID || "",
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
      code,
      redirect_uri: `${getBaseUrl()}/api/cloud-storage/callback/onedrive`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("OneDrive token exchange failed:", err);
    throw new Error("Failed to exchange OneDrive authorization code");
  }
  return res.json();
}

export async function exchangeGoogleDriveCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      code,
      redirect_uri: `${getBaseUrl()}/api/cloud-storage/callback/googledrive`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("Google Drive token exchange failed:", err);
    throw new Error("Failed to exchange Google Drive authorization code");
  }
  return res.json();
}

// =============================================================================
// Token Refresh
// =============================================================================

async function refreshOneDriveToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const res = await fetch(`${MICROSOFT_AUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID || "",
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Failed to refresh OneDrive token");
  return res.json();
}

async function refreshGoogleDriveToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Failed to refresh Google Drive token");
  return res.json();
}

// =============================================================================
// Get Valid Access Token (auto-refresh if expired)
// =============================================================================

export async function getValidAccessToken(
  connectionId: string
): Promise<{ accessToken: string; provider: CloudProvider }> {
  const conn = await prisma.cloudStorageConnection.findUnique({
    where: { id: connectionId },
  });
  if (!conn || !conn.isActive) throw new Error("Cloud storage not connected");

  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 min buffer

  if (conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() - bufferMs > now.getTime()) {
    return { accessToken: conn.accessToken, provider: conn.provider as CloudProvider };
  }

  // Token expired or about to expire - refresh
  if (!conn.refreshToken) throw new Error("No refresh token available - please reconnect");

  let newTokens;
  if (conn.provider === "onedrive") {
    newTokens = await refreshOneDriveToken(conn.refreshToken);
  } else {
    newTokens = await refreshGoogleDriveToken(conn.refreshToken);
  }

  await prisma.cloudStorageConnection.update({
    where: { id: connectionId },
    data: {
      accessToken: newTokens.access_token,
      refreshToken: (newTokens as { refresh_token?: string }).refresh_token || conn.refreshToken,
      tokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
    },
  });

  return { accessToken: newTokens.access_token, provider: conn.provider as CloudProvider };
}

// =============================================================================
// User Profile Fetchers
// =============================================================================

export async function getMicrosoftProfile(accessToken: string): Promise<{ email: string; name: string }> {
  const res = await fetch(`${MICROSOFT_GRAPH_URL}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to get Microsoft profile");
  const data = await res.json();
  return {
    email: data.mail || data.userPrincipalName || "",
    name: data.displayName || "",
  };
}

export async function getGoogleProfile(accessToken: string): Promise<{ email: string; name: string }> {
  const res = await fetch(`${GOOGLE_API_URL}/oauth2/v2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to get Google profile");
  const data = await res.json();
  return {
    email: data.email || "",
    name: data.name || "",
  };
}

// =============================================================================
// Folder Management - OneDrive
// =============================================================================

async function findOrCreateOneDriveFolder(
  accessToken: string,
  parentPath: string,
  folderName: string
): Promise<string> {
  // Try to get existing folder
  const checkPath = parentPath === "root"
    ? `${MICROSOFT_GRAPH_URL}/me/drive/root/children`
    : `${MICROSOFT_GRAPH_URL}/me/drive/items/${parentPath}/children`;

  const listRes = await fetch(`${checkPath}?$filter=name eq '${encodeURIComponent(folderName)}'&$select=id,name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (listRes.ok) {
    const data = await listRes.json();
    if (data.value && data.value.length > 0) {
      return data.value[0].id;
    }
  }

  // Create folder
  const createPath = parentPath === "root"
    ? `${MICROSOFT_GRAPH_URL}/me/drive/root/children`
    : `${MICROSOFT_GRAPH_URL}/me/drive/items/${parentPath}/children`;

  const createRes = await fetch(createPath, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      folder: {},
      "@microsoft.graph.conflictBehavior": "fail",
    }),
  });

  if (!createRes.ok) {
    // If conflict (409), the folder already exists — search again to get its ID
    if (createRes.status === 409) {
      const retryRes = await fetch(`${checkPath}?$filter=name eq '${encodeURIComponent(folderName)}'&$select=id,name`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (retryRes.ok) {
        const retryData = await retryRes.json();
        if (retryData.value && retryData.value.length > 0) {
          return retryData.value[0].id;
        }
      }
    }
    const err = await createRes.text();
    console.error(`Failed to create OneDrive folder '${folderName}':`, err);
    throw new Error(`Failed to create folder: ${folderName}`);
  }

  const folder = await createRes.json();
  return folder.id;
}

// =============================================================================
// Folder Management - Google Drive
// =============================================================================

async function findOrCreateGoogleDriveFolder(
  accessToken: string,
  parentId: string | null,
  folderName: string
): Promise<string> {
  // Search for existing folder
  const parentQuery = parentId ? `'${parentId}' in parents and ` : "";
  const query = `${parentQuery}name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const searchRes = await fetch(
    `${GOOGLE_API_URL}/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // Create folder
  const metadata: Record<string, unknown> = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const createRes = await fetch(`${GOOGLE_API_URL}/drive/v3/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error(`Failed to create Google Drive folder '${folderName}':`, err);
    throw new Error(`Failed to create folder: ${folderName}`);
  }

  const folder = await createRes.json();
  return folder.id;
}

// =============================================================================
// Ensure Root + Category Folder Exists
// =============================================================================

export async function ensureCategoryFolder(
  connectionId: string,
  categoryName: string
): Promise<{ folderId: string; provider: CloudProvider }> {
  const { accessToken, provider } = await getValidAccessToken(connectionId);
  const conn = await prisma.cloudStorageConnection.findUnique({
    where: { id: connectionId },
  });

  if (provider === "onedrive") {
    // Ensure root folder
    let rootId = conn?.rootFolderId;
    if (!rootId) {
      rootId = await findOrCreateOneDriveFolder(accessToken, "root", ROOT_FOLDER_NAME);
      await prisma.cloudStorageConnection.update({
        where: { id: connectionId },
        data: { rootFolderId: rootId },
      });
    }
    // Create category subfolder
    const catFolderId = await findOrCreateOneDriveFolder(accessToken, rootId, categoryName);
    return { folderId: catFolderId, provider };
  } else {
    // Google Drive
    let rootId = conn?.rootFolderId;
    if (!rootId) {
      rootId = await findOrCreateGoogleDriveFolder(accessToken, null, ROOT_FOLDER_NAME);
      await prisma.cloudStorageConnection.update({
        where: { id: connectionId },
        data: { rootFolderId: rootId },
      });
    }
    const catFolderId = await findOrCreateGoogleDriveFolder(accessToken, rootId, categoryName);
    return { folderId: catFolderId, provider };
  }
}

// =============================================================================
// File Upload
// =============================================================================

export async function uploadToCloudStorage(
  connectionId: string,
  categoryName: string,
  fileName: string,
  fileBuffer: Buffer,
  contentType: string,
  overrideFolderId?: string | null
): Promise<{ cloudFileId: string; cloudFileName: string; provider: CloudProvider; folderName: string }> {
  let folderId: string;
  let provider: CloudProvider;
  if (overrideFolderId) {
    // Use the pre-mapped folder directly
    const token = await getValidAccessToken(connectionId);
    folderId = overrideFolderId;
    provider = token.provider;
  } else {
    const result = await ensureCategoryFolder(connectionId, categoryName);
    folderId = result.folderId;
    provider = result.provider;
  }
  const { accessToken } = await getValidAccessToken(connectionId);

  if (provider === "onedrive") {
    // Upload to OneDrive
    const uploadUrl = `${MICROSOFT_GRAPH_URL}/me/drive/items/${folderId}:/${encodeURIComponent(fileName)}:/content`;
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": contentType,
      },
      body: fileBuffer,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OneDrive upload failed:", err);
      throw new Error("Failed to upload to OneDrive");
    }

    const file = await res.json();
    return { cloudFileId: file.id, cloudFileName: file.name, provider, folderName: categoryName };
  } else {
    // Upload to Google Drive (multipart)
    const boundary = "-------CloudStorageBoundary";
    const metadata = JSON.stringify({
      name: fileName,
      parents: [folderId],
    });

    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      metadata,
      `--${boundary}`,
      `Content-Type: ${contentType}`,
      "Content-Transfer-Encoding: base64",
      "",
      fileBuffer.toString("base64"),
      `--${boundary}--`,
    ].join("\r\n");

    const res = await fetch(
      `${GOOGLE_API_URL}/upload/drive/v3/files?uploadType=multipart&fields=id,name`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Google Drive upload failed:", err);
      throw new Error("Failed to upload to Google Drive");
    }

    const file = await res.json();
    return { cloudFileId: file.id, cloudFileName: file.name, provider, folderName: categoryName };
  }
}

// =============================================================================
// Get user's active cloud storage connection
// =============================================================================

export async function getUserCloudConnection(userId: string) {
  return prisma.cloudStorageConnection.findFirst({
    where: { userId, isActive: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getUserCloudConnections(userId: string) {
  return prisma.cloudStorageConnection.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

// =============================================================================
// List Folders inside Root "Cost CheqMate" Folder
// =============================================================================

export async function listCloudFolders(
  connectionId: string
): Promise<{ id: string; name: string }[]> {
  const { accessToken, provider } = await getValidAccessToken(connectionId);
  const conn = await prisma.cloudStorageConnection.findUnique({
    where: { id: connectionId },
  });

  if (provider === "onedrive") {
    let rootId = conn?.rootFolderId;
    if (!rootId) {
      rootId = await findOrCreateOneDriveFolder(accessToken, "root", ROOT_FOLDER_NAME);
      await prisma.cloudStorageConnection.update({
        where: { id: connectionId },
        data: { rootFolderId: rootId },
      });
    }
    // List children folders (fetch all, filter client-side since $filter=folder ne null is unsupported)
    const listUrl = `${MICROSOFT_GRAPH_URL}/me/drive/items/${rootId}/children?$select=id,name,folder&$orderby=name&$top=200`;
    const res = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.error("Failed to list OneDrive folders:", await res.text());
      return [];
    }
    const data = await res.json();
    return (data.value || [])
      .filter((f: { folder?: object }) => f.folder != null)
      .map((f: { id: string; name: string }) => ({
        id: f.id,
        name: f.name,
      }));
  } else {
    // Google Drive
    let rootId = conn?.rootFolderId;
    if (!rootId) {
      rootId = await findOrCreateGoogleDriveFolder(accessToken, null, ROOT_FOLDER_NAME);
      await prisma.cloudStorageConnection.update({
        where: { id: connectionId },
        data: { rootFolderId: rootId },
      });
    }
    const query = `'${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res = await fetch(
      `${GOOGLE_API_URL}/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      console.error("Failed to list Google Drive folders:", await res.text());
      return [];
    }
    const data = await res.json();
    return (data.files || []).map((f: { id: string; name: string }) => ({
      id: f.id,
      name: f.name,
    }));
  }
}

// =============================================================================
// Browse any folder level (for folder picker UI)
// =============================================================================

export async function browseCloudFolders(
  connectionId: string,
  parentId?: string | null
): Promise<{ id: string; name: string }[]> {
  const { accessToken, provider } = await getValidAccessToken(connectionId);

  if (provider === "onedrive") {
    const target = parentId || "root";
    // $filter=folder ne null is not officially supported; fetch all children and filter client-side
    const listUrl = `${MICROSOFT_GRAPH_URL}/me/drive/items/${target}/children?$select=id,name,folder&$orderby=name&$top=200`;
    const res = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.error("Failed to browse OneDrive folders:", await res.text());
      return [];
    }
    const data = await res.json();
    return (data.value || [])
      .filter((f: { folder?: object }) => f.folder != null)
      .map((f: { id: string; name: string }) => ({
        id: f.id,
        name: f.name,
      }));
  } else {
    // Google Drive
    const target = parentId || "root";
    const query = `'${target}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res = await fetch(
      `${GOOGLE_API_URL}/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      console.error("Failed to browse Google Drive folders:", await res.text());
      return [];
    }
    const data = await res.json();
    return (data.files || []).map((f: { id: string; name: string }) => ({
      id: f.id,
      name: f.name,
    }));
  }
}

// =============================================================================
// Ensure a subfolder exists inside a given parent folder
// Used for year folder → category structure
// =============================================================================

export async function ensureSubfolder(
  connectionId: string,
  parentFolderId: string,
  subfolderName: string
): Promise<string> {
  const { accessToken, provider } = await getValidAccessToken(connectionId);

  if (provider === "onedrive") {
    return findOrCreateOneDriveFolder(accessToken, parentFolderId, subfolderName);
  } else {
    return findOrCreateGoogleDriveFolder(accessToken, parentFolderId, subfolderName);
  }
}

// =============================================================================
// Create a New Folder inside Root "Cost CheqMate" Folder
// =============================================================================

export async function createCloudFolder(
  connectionId: string,
  folderName: string
): Promise<{ id: string; name: string }> {
  const { accessToken, provider } = await getValidAccessToken(connectionId);
  const conn = await prisma.cloudStorageConnection.findUnique({
    where: { id: connectionId },
  });

  if (provider === "onedrive") {
    let rootId = conn?.rootFolderId;
    if (!rootId) {
      rootId = await findOrCreateOneDriveFolder(accessToken, "root", ROOT_FOLDER_NAME);
      await prisma.cloudStorageConnection.update({
        where: { id: connectionId },
        data: { rootFolderId: rootId },
      });
    }
    const folderId = await findOrCreateOneDriveFolder(accessToken, rootId, folderName);
    return { id: folderId, name: folderName };
  } else {
    let rootId = conn?.rootFolderId;
    if (!rootId) {
      rootId = await findOrCreateGoogleDriveFolder(accessToken, null, ROOT_FOLDER_NAME);
      await prisma.cloudStorageConnection.update({
        where: { id: connectionId },
        data: { rootFolderId: rootId },
      });
    }
    const folderId = await findOrCreateGoogleDriveFolder(accessToken, rootId, folderName);
    return { id: folderId, name: folderName };
  }
}
