import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

const prisma = new PrismaClient();

// resource.action permission catalog (RBAC.md section 9 + Trello domain).
const PERMISSIONS = [
  // Users
  { key: "users.list", description: "List users" },
  { key: "users.read", description: "View a user" },
  { key: "users.create", description: "Create a user" },
  { key: "users.update", description: "Update a user" },
  { key: "users.delete", description: "Delete a user" },
  { key: "users.invite", description: "Invite a user" },
  { key: "users.suspend", description: "Suspend a user" },
  { key: "users.reset_password", description: "Reset a user's password" },
  { key: "users.impersonate", description: "Impersonate a user" },
  // Roles / permissions
  { key: "roles.list", description: "List roles" },
  { key: "roles.create", description: "Create a role" },
  { key: "roles.update", description: "Update a role" },
  { key: "roles.delete", description: "Delete a role" },
  { key: "roles.assign", description: "Assign roles to users" },
  { key: "permissions.list", description: "List permissions" },
  // Workspaces
  { key: "workspaces.list", description: "List workspaces" },
  { key: "workspaces.read", description: "View a workspace" },
  { key: "workspaces.create", description: "Create a workspace" },
  { key: "workspaces.update", description: "Update a workspace" },
  { key: "workspaces.delete", description: "Delete a workspace" },
  { key: "workspaces.lock", description: "Lock or unlock a workspace" },
  // Boards
  { key: "boards.list", description: "List boards" },
  { key: "boards.read", description: "View a board" },
  { key: "boards.create", description: "Create a board" },
  { key: "boards.update", description: "Update a board" },
  { key: "boards.delete", description: "Delete a board" },
  // Lists
  { key: "lists.create", description: "Create a list" },
  { key: "lists.update", description: "Update a list" },
  { key: "lists.delete", description: "Delete a list" },
  // Cards
  { key: "cards.create", description: "Create a card" },
  { key: "cards.read", description: "View a card" },
  { key: "cards.update", description: "Update / move a card" },
  { key: "cards.delete", description: "Delete a card" },
  // Comments / attachments
  { key: "comments.create", description: "Create a comment" },
  { key: "comments.update", description: "Edit a comment" },
  { key: "comments.delete", description: "Delete a comment" },
  { key: "attachments.create", description: "Upload an attachment" },
  { key: "attachments.delete", description: "Delete an attachment" },
  // System
  { key: "system.view_audit_log", description: "View the audit log" },
  { key: "system.manage_settings", description: "Manage system settings" },
  { key: "system.impersonate", description: "Log in as another user" },
  { key: "storage.view", description: "View storage usage" },
  { key: "storage.manage", description: "Manage / clean up storage" },
];

const ROLES = [
  { key: "super_admin", name: "Super Admin", description: "Full access; bypasses all checks" },
  { key: "admin", name: "Admin", description: "Operations management" },
  { key: "support", name: "Support", description: "Read-only ops + impersonate for debugging" },
  { key: "user", name: "User", description: "Regular end user" },
];

// Workspace/board scoped roles (tier B). Non-system; granted with tenantId=workspaceId.
const SCOPED_ROLES = [
  { key: "ws_owner", name: "Workspace Owner", description: "Owns a workspace" },
  { key: "ws_admin", name: "Workspace Admin", description: "Manages a workspace" },
  { key: "ws_member", name: "Workspace Member", description: "Member of a workspace" },
  { key: "ws_guest", name: "Workspace Guest", description: "Limited workspace access" },
  { key: "board_admin", name: "Board Admin", description: "Manages a board" },
  { key: "board_member", name: "Board Member", description: "Member of a board" },
  { key: "observer", name: "Observer", description: "Read-only board access" },
];

// Permission keys granted to each role (super_admin bypasses, so empty here).
const ROLE_PERMS = {
  super_admin: [],
  admin: [
    "users.list", "users.read", "users.create", "users.update",
    "users.invite", "users.suspend", "users.reset_password",
    "roles.list", "roles.assign", "permissions.list",
    "workspaces.list", "workspaces.read", "workspaces.create", "workspaces.update", "workspaces.delete", "workspaces.lock",
    "boards.list", "boards.read", "boards.create", "boards.update", "boards.delete",
    "lists.create", "lists.update", "lists.delete",
    "cards.create", "cards.read", "cards.update", "cards.delete",
    "comments.create", "comments.update", "comments.delete",
    "attachments.create", "attachments.delete",
    "system.view_audit_log", "storage.view",
  ],
  support: [
    "users.list", "users.read",
    "workspaces.list", "workspaces.read",
    "boards.list", "boards.read",
    "cards.read",
    "system.view_audit_log", "system.impersonate",
  ],
  user: [
    "workspaces.list", "workspaces.read", "workspaces.create", "workspaces.update",
    "boards.list", "boards.read", "boards.create", "boards.update", "boards.delete",
    "lists.create", "lists.update", "lists.delete",
    "cards.create", "cards.read", "cards.update", "cards.delete",
    "comments.create", "comments.update", "comments.delete",
    "attachments.create", "attachments.delete",
  ],
};

async function main() {
  // Permissions
  for (const p of PERMISSIONS) {
    const [resource, action] = p.key.split(".");
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { resource, action, description: p.description },
      create: { key: p.key, resource, action, description: p.description },
    });
  }

  // Roles (all system)
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { key: r.key },
      update: { name: r.name, description: r.description, isSystem: true },
      create: { key: r.key, name: r.name, description: r.description, isSystem: true },
    });
  }

  // Scoped roles (non-system)
  for (const r of SCOPED_ROLES) {
    await prisma.role.upsert({
      where: { key: r.key },
      update: { name: r.name, description: r.description, isSystem: false },
      create: { key: r.key, name: r.name, description: r.description, isSystem: false },
    });
  }

  // Role -> permission mapping
  const allPerms = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permIdByKey = new Map(allPerms.map((p) => [p.key, p.id]));

  for (const [roleKey, permKeys] of Object.entries(ROLE_PERMS)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permKeys.length === 0) continue;
    await prisma.rolePermission.createMany({
      data: permKeys
        .map((k) => permIdByKey.get(k))
        .filter((id) => id != null)
        .map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }

  // Seed super_admin user (skipped on Prod so the first-run setup page is used).
  if (!env.SEED_SUPER_ADMIN) {
    console.log("Seed complete. SEED_SUPER_ADMIN=false -> use first-run setup page to create super_admin.");
    return;
  }
  const superRole = await prisma.role.findUniqueOrThrow({ where: { key: "super_admin" } });
  const passwordHash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: env.SEED_ADMIN_EMAIL },
    update: {},
    create: {
      email: env.SEED_ADMIN_EMAIL,
      passwordHash,
      name: "Super Admin",
      isActive: true,
    },
    select: { id: true },
  });
  const existingLink = await prisma.userRole.findFirst({
    where: { userId: admin.id, roleId: superRole.id, tenantId: null },
  });
  if (!existingLink) {
    await prisma.userRole.create({
      data: { userId: admin.id, roleId: superRole.id, tenantId: null },
    });
  }

  console.log(`Seed complete. super_admin = ${env.SEED_ADMIN_EMAIL}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
