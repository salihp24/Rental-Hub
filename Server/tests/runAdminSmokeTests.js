import assert from "node:assert/strict";

import isAdmin from "../middleware/admin/isAdmin.js";
import AppError from "../utils/AppError.js";
import { adminValidation } from "../validation/admin/adminValidation.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import AdminAuditLog from "../models/AdminAuditLog.js";
import {
  updateAdminProductFeaturedService,
  updateAdminProductStatusService,
  updateAdminUserRoleService,
  updateAdminUserStatusService,
} from "../Services/admin/admin.services.js";

const makeUserDoc = ({ id, roles = ["renter"], isActive = true, email = "user@example.com" }) => ({
  _id: id,
  role: roles,
  isActive,
  email,
  hasRole(role) {
    return this.role.includes(role);
  },
  toObject() {
    return {
      _id: this._id,
      role: this.role,
      isActive: this.isActive,
      email: this.email,
      password: "secret",
    };
  },
  async save() {
    return this;
  },
});

const makeProductDoc = ({
  id,
  status = "under_review",
  isFeatured = false,
  title = "Sample Product",
  ownerEmail = "owner@example.com",
} = {}) => ({
  _id: id,
  status,
  isFeatured,
  title,
  owner: { email: ownerEmail },
  moderation: {
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: "",
    rejectionReason: "",
    toObject() {
      return { ...this };
    },
  },
  async save() {
    return this;
  },
  populate() {
    return this;
  },
});

const tests = [];

const addTest = (name, fn) => {
  tests.push({ name, fn });
};

addTest("isAdmin returns 401 when req.user is missing", () => {
  let receivedError = null;
  isAdmin({}, {}, (err) => {
    receivedError = err;
  });
  assert.ok(receivedError instanceof AppError);
  assert.equal(receivedError.statusCode, 401);
});

addTest("isAdmin returns 403 for non-admin users", () => {
  let receivedError = null;
  isAdmin(
    { user: makeUserDoc({ id: "u1", roles: ["renter"] }) },
    {},
    (err) => {
      receivedError = err;
    }
  );
  assert.ok(receivedError instanceof AppError);
  assert.equal(receivedError.statusCode, 403);
});

addTest("isAdmin allows admin users", () => {
  let nextCalled = false;
  isAdmin(
    { user: makeUserDoc({ id: "u2", roles: ["admin"] }) },
    {},
    (err) => {
      assert.equal(err, undefined);
      nextCalled = true;
    }
  );
  assert.equal(nextCalled, true);
});

addTest("admin listUsers query validation accepts valid filters", () => {
  const { error, value } = adminValidation.listUsersQuery.query.validate({
    role: "admin",
    isActive: true,
    page: 1,
    limit: 5,
  });
  assert.equal(error, undefined);
  assert.equal(value.role, "admin");
  assert.equal(value.isActive, true);
});

addTest("admin listUsers query validation rejects invalid role", () => {
  const { error } = adminValidation.listUsersQuery.query.validate({
    role: "superadmin",
  });
  assert.ok(error);
});

addTest("admin user role validation accepts role array", () => {
  const { error, value } = adminValidation.updateUserRole.body.validate({
    role: ["renter", "admin"],
  });
  assert.equal(error, undefined);
  assert.deepEqual(value.role, ["renter", "admin"]);
});

addTest("admin user role validation rejects unknown role", () => {
  const { error } = adminValidation.updateUserRole.body.validate({
    role: ["superadmin"],
  });
  assert.ok(error);
});

addTest("admin booking list validation accepts extended filters", () => {
  const { error } = adminValidation.listBookingsQuery.query.validate({
    orderCode: "RH-XYZ",
    startDateFrom: "2026-01-01T00:00:00.000Z",
    startDateTo: "2026-01-30T00:00:00.000Z",
    createdFrom: "2026-01-01T00:00:00.000Z",
    createdTo: "2026-01-30T00:00:00.000Z",
    sort: "-createdAt",
  });
  assert.equal(error, undefined);
});

addTest("admin product status validation requires rejectionReason when inactive", () => {
  const { error } = adminValidation.updateProductStatus.body.validate({
    status: "inactive",
    reviewNote: "Not meeting listing standards",
  });
  assert.ok(error);
});

addTest("updateAdminUserStatusService blocks self-deactivation", async () => {
  const originalFindById = User.findById;
  User.findById = async () =>
    makeUserDoc({
      id: "000000000000000000000001",
      roles: ["admin"],
      isActive: true,
      email: "admin@example.com",
    });

  try {
    await assert.rejects(
      () =>
        updateAdminUserStatusService({
          adminUser: makeUserDoc({
            id: "000000000000000000000001",
            roles: ["admin"],
            isActive: true,
            email: "admin@example.com",
          }),
          targetUserId: "000000000000000000000001",
          isActive: false,
        }),
      (err) => err instanceof AppError && err.statusCode === 400
    );
  } finally {
    User.findById = originalFindById;
  }
});

addTest("updateAdminUserStatusService blocks deactivating last active admin", async () => {
  const originalFindById = User.findById;
  const originalCountDocuments = User.countDocuments;
  User.findById = async () =>
    makeUserDoc({
      id: "000000000000000000000002",
      roles: ["admin"],
      isActive: true,
      email: "only-admin@example.com",
    });
  User.countDocuments = async () => 1;

  try {
    await assert.rejects(
      () =>
        updateAdminUserStatusService({
          adminUser: makeUserDoc({
            id: "000000000000000000000099",
            roles: ["admin"],
            isActive: true,
            email: "another@example.com",
          }),
          targetUserId: "000000000000000000000002",
          isActive: false,
        }),
      (err) => err instanceof AppError && err.statusCode === 400
    );
  } finally {
    User.findById = originalFindById;
    User.countDocuments = originalCountDocuments;
  }
});

addTest("updateAdminUserStatusService updates status and creates audit log", async () => {
  const originalFindById = User.findById;
  const originalCountDocuments = User.countDocuments;
  const originalAuditCreate = AdminAuditLog.create;

  let auditPayload = null;
  User.findById = async () =>
    makeUserDoc({
      id: "000000000000000000000003",
      roles: ["renter"],
      isActive: true,
      email: "target@example.com",
    });
  User.countDocuments = async () => 2;
  AdminAuditLog.create = async (payload) => {
    auditPayload = payload;
    return payload;
  };

  try {
    const result = await updateAdminUserStatusService({
      adminUser: makeUserDoc({
        id: "000000000000000000000100",
        roles: ["admin"],
        isActive: true,
        email: "admin@example.com",
      }),
      targetUserId: "000000000000000000000003",
      isActive: false,
    });

    assert.equal(result.isActive, false);
    assert.equal(result.password, undefined);
    assert.ok(auditPayload);
    assert.equal(auditPayload.action, "user.status.updated");
    assert.equal(String(auditPayload.actor), "000000000000000000000100");
    assert.equal(String(auditPayload.entityId), "000000000000000000000003");
  } finally {
    User.findById = originalFindById;
    User.countDocuments = originalCountDocuments;
    AdminAuditLog.create = originalAuditCreate;
  }
});

addTest("updateAdminUserRoleService blocks removing own admin role", async () => {
  const originalFindById = User.findById;
  User.findById = async () =>
    makeUserDoc({
      id: "000000000000000000000020",
      roles: ["admin"],
      isActive: true,
      email: "selfadmin@example.com",
    });

  try {
    await assert.rejects(
      () =>
        updateAdminUserRoleService({
          adminUser: makeUserDoc({
            id: "000000000000000000000020",
            roles: ["admin"],
            isActive: true,
            email: "selfadmin@example.com",
          }),
          targetUserId: "000000000000000000000020",
          role: ["renter"],
        }),
      (err) => err instanceof AppError && err.statusCode === 400
    );
  } finally {
    User.findById = originalFindById;
  }
});

addTest("updateAdminUserRoleService updates role and writes audit log", async () => {
  const originalFindById = User.findById;
  const originalCountDocuments = User.countDocuments;
  const originalAuditCreate = AdminAuditLog.create;
  let auditPayload = null;

  User.findById = async () =>
    makeUserDoc({
      id: "000000000000000000000021",
      roles: ["renter"],
      isActive: true,
      email: "role-target@example.com",
    });
  User.countDocuments = async () => 2;
  AdminAuditLog.create = async (payload) => {
    auditPayload = payload;
    return payload;
  };

  try {
    const result = await updateAdminUserRoleService({
      adminUser: makeUserDoc({
        id: "000000000000000000000022",
        roles: ["admin"],
        isActive: true,
        email: "admin@example.com",
      }),
      targetUserId: "000000000000000000000021",
      role: ["renter", "owner"],
    });
    assert.deepEqual(result.role, ["renter", "owner"]);
    assert.equal(auditPayload.action, "user.role.updated");
  } finally {
    User.findById = originalFindById;
    User.countDocuments = originalCountDocuments;
    AdminAuditLog.create = originalAuditCreate;
  }
});

addTest("updateAdminProductFeaturedService updates featured flag with audit", async () => {
  const originalFindById = Product.findById;
  const originalAuditCreate = AdminAuditLog.create;
  let auditPayload = null;

  Product.findById = () => ({
    populate: async () =>
      makeProductDoc({
        id: "000000000000000000000031",
        status: "active",
        isFeatured: false,
      }),
  });
  AdminAuditLog.create = async (payload) => {
    auditPayload = payload;
    return payload;
  };

  try {
    const result = await updateAdminProductFeaturedService({
      productId: "000000000000000000000031",
      isFeatured: true,
      adminUser: makeUserDoc({
        id: "000000000000000000000032",
        roles: ["admin"],
      }),
    });
    assert.equal(result.isFeatured, true);
    assert.equal(auditPayload.action, "product.featured.updated");
  } finally {
    Product.findById = originalFindById;
    AdminAuditLog.create = originalAuditCreate;
  }
});

addTest("updateAdminProductStatusService stores moderation fields", async () => {
  const originalFindById = Product.findById;
  const originalAuditCreate = AdminAuditLog.create;
  let auditPayload = null;

  Product.findById = () => ({
    populate: async () =>
      makeProductDoc({
        id: "000000000000000000000041",
        status: "under_review",
        isFeatured: false,
      }),
  });
  AdminAuditLog.create = async (payload) => {
    auditPayload = payload;
    return payload;
  };

  try {
    const result = await updateAdminProductStatusService({
      productId: "000000000000000000000041",
      status: "inactive",
      reviewNote: "Missing required details",
      rejectionReason: "Images do not match listing title",
      adminUser: makeUserDoc({
        id: "000000000000000000000042",
        roles: ["admin"],
      }),
    });
    assert.equal(result.status, "inactive");
    assert.equal(result.moderation.reviewNote, "Missing required details");
    assert.equal(result.moderation.rejectionReason, "Images do not match listing title");
    assert.equal(auditPayload.action, "product.status.updated");
  } finally {
    Product.findById = originalFindById;
    AdminAuditLog.create = originalAuditCreate;
  }
});

const run = async () => {
  let passed = 0;
  let failed = 0;

  for (const entry of tests) {
    try {
      await entry.fn();
      passed += 1;
      console.log(`PASS: ${entry.name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL: ${entry.name}`);
      console.error(error);
    }
  }

  console.log(`\nAdmin smoke tests complete. Passed: ${passed}, Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
};

run();
