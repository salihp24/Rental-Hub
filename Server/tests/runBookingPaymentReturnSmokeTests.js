import assert from "node:assert/strict";
import crypto from "crypto";
import mongoose from "mongoose";

import Booking from "../models/Booking.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import AppError from "../utils/AppError.js";
import {
  cancelBookingService,
  createBookingService,
  listMyBookingsService,
  updateBookingStatusService,
  verifyRazorpayPaymentService,
} from "../Services/booking.services.js";

const tests = [];

const addTest = (name, fn) => {
  tests.push({ name, fn });
};

const id = (hex) => new mongoose.Types.ObjectId(hex);

const makeUser = ({ _id, role = ["renter"], isActive = true, ownerProfile = {} }) => ({
  _id,
  role,
  isActive,
  ownerProfile,
  hasRole(name) {
    return this.role.includes(name);
  },
});

const setupDb = () => {
  const users = new Map();
  const products = new Map();
  const bookings = new Map();
  let bookingCounter = 1;

  const asDate = (value) => new Date(value);

  const decorateBookingDoc = (doc) => {
    if (!doc) return null;
    doc.save = async function save() {
      bookings.set(String(this._id), this);
      return this;
    };
    return doc;
  };

  const populateBooking = (doc) => {
    if (!doc) return null;
    return doc;
  };

  const bookingQueryFromArray = (arr) => ({
    _result: arr,
    populate() {
      this._result = this._result.map((entry) => populateBooking(entry));
      return this;
    },
    sort() {
      return this;
    },
    skip(count) {
      this._result = this._result.slice(count);
      return this;
    },
    limit(count) {
      this._result = this._result.slice(0, count);
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(this._result).then(resolve, reject);
    },
  });

  const original = {
    bookingFindById: Booking.findById,
    bookingCreate: Booking.create,
    bookingFind: Booking.find,
    bookingCountDocuments: Booking.countDocuments,
    bookingUpdateMany: Booking.updateMany,
    productFindById: Product.findById,
    productUpdateOne: Product.updateOne,
    userFindById: User.findById,
    conversationFind: Conversation.find,
    messageFindOne: Message.findOne,
  };

  Booking.findById = (bookingId) => {
    const doc = bookings.get(String(bookingId)) || null;
    const decorated = decorateBookingDoc(doc);
    return {
      populate: async () => populateBooking(decorated),
      then(resolve, reject) {
        return Promise.resolve(decorated).then(resolve, reject);
      },
    };
  };

  Booking.create = async (payload) => {
    const bookingId = new mongoose.Types.ObjectId(
      bookingCounter.toString(16).padStart(24, "0")
    );
    bookingCounter += 1;
    const booking = decorateBookingDoc({
      _id: bookingId,
      ...payload,
      status: "pending",
      createdAt: new Date(),
      paymentDetails: payload.paymentDetails || {},
      cancellation: payload.cancellation || {},
      returnFlow: payload.returnFlow || {},
      toObject() {
        return { ...this };
      },
    });
    bookings.set(String(bookingId), booking);
    return booking;
  };

  Booking.find = (filter) => {
    let arr = [...bookings.values()];
    if (filter.renter) arr = arr.filter((b) => String(b.renter) === String(filter.renter));
    if (filter.owner) arr = arr.filter((b) => String(b.owner) === String(filter.owner));
    if (filter.status) arr = arr.filter((b) => b.status === filter.status);
    if (filter.$or) {
      arr = arr.filter((b) =>
        filter.$or.some((cond) =>
          (cond.renter && String(b.renter) === String(cond.renter)) ||
          (cond.owner && String(b.owner) === String(cond.owner))
        )
      );
    }
    return bookingQueryFromArray(arr);
  };

  Booking.countDocuments = async (filter) => {
    const items = await Booking.find(filter);
    return items.length;
  };

  Booking.updateMany = async (filter, update) => {
    let modifiedCount = 0;
    for (const booking of bookings.values()) {
      if (filter.status && booking.status !== filter.status) continue;
      if (filter.endDate?.$lte && asDate(booking.endDate) > asDate(filter.endDate.$lte)) continue;
      if (filter.renter && String(booking.renter) !== String(filter.renter)) continue;
      if (filter.owner && String(booking.owner) !== String(filter.owner)) continue;
      if (filter.$or) {
        const pass = filter.$or.some(
          (cond) =>
            (cond.renter && String(booking.renter) === String(cond.renter)) ||
            (cond.owner && String(booking.owner) === String(cond.owner))
        );
        if (!pass) continue;
      }

      modifiedCount += 1;
      if (update.$set?.status) booking.status = update.$set.status;
      if (update.$set?.["returnFlow.requestedAt"]) {
        booking.returnFlow = booking.returnFlow || {};
        booking.returnFlow.requestedAt = update.$set["returnFlow.requestedAt"];
      }
      if (update.$set?.["returnFlow.requestedBy"] !== undefined) {
        booking.returnFlow = booking.returnFlow || {};
        booking.returnFlow.requestedBy = update.$set["returnFlow.requestedBy"];
      }
      bookings.set(String(booking._id), booking);
    }
    return { modifiedCount };
  };

  Product.findById = (productId) => {
    const doc = products.get(String(productId)) || null;
    return {
      select: async () => doc,
      then(resolve, reject) {
        return Promise.resolve(doc).then(resolve, reject);
      },
    };
  };

  Product.updateOne = async (filter, update) => {
    const doc = products.get(String(filter._id));
    if (!doc) return { acknowledged: false };

    if (update.$addToSet?.blockedDates) {
      doc.blockedDates = doc.blockedDates || [];
      const incoming = update.$addToSet.blockedDates;
      if (!doc.blockedDates.some((d) => String(d.bookingId) === String(incoming.bookingId))) {
        doc.blockedDates.push(incoming);
      }
    }
    if (update.$pull?.blockedDates?.bookingId) {
      doc.blockedDates = (doc.blockedDates || []).filter(
        (d) => String(d.bookingId) !== String(update.$pull.blockedDates.bookingId)
      );
    }
    if (update.$inc?.totalRentals) {
      doc.totalRentals = (doc.totalRentals || 0) + update.$inc.totalRentals;
    }

    products.set(String(doc._id), doc);
    return { acknowledged: true };
  };

  User.findById = (userId) => {
    const doc = users.get(String(userId)) || null;
    return {
      select: async () => doc,
      then(resolve, reject) {
        return Promise.resolve(doc).then(resolve, reject);
      },
    };
  };

  Conversation.find = () => ({
    select: async () => [],
    then(resolve, reject) {
      return Promise.resolve([]).then(resolve, reject);
    },
  });

  Message.findOne = () => ({
    sort: async () => null,
    then(resolve, reject) {
      return Promise.resolve(null).then(resolve, reject);
    },
  });

  const restore = () => {
    Booking.findById = original.bookingFindById;
    Booking.create = original.bookingCreate;
    Booking.find = original.bookingFind;
    Booking.countDocuments = original.bookingCountDocuments;
    Booking.updateMany = original.bookingUpdateMany;
    Product.findById = original.productFindById;
    Product.updateOne = original.productUpdateOne;
    User.findById = original.userFindById;
    Conversation.find = original.conversationFind;
    Message.findOne = original.messageFindOne;
  };

  return { users, products, bookings, restore };
};

addTest("booking -> payment verify -> active -> return flow completes", async () => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret";

  const db = setupDb();
  try {
    const renterId = id("111111111111111111111111");
    const ownerId = id("222222222222222222222222");
    const productId = id("333333333333333333333333");

    const renter = makeUser({ _id: renterId, role: ["renter"] });
    const owner = makeUser({ _id: ownerId, role: ["owner"] });

    db.users.set(String(renterId), renter);
    db.users.set(String(ownerId), owner);
    db.products.set(String(productId), {
      _id: productId,
      owner: ownerId,
      title: "Drill",
      status: "active",
      blockedDates: [],
      totalRentals: 0,
      pricing: { daily: { enabled: true, rate: 1000 }, currency: "INR" },
      rentalRules: {
        minRentalDays: 1,
        maxRentalDays: 30,
        advanceBookingDays: 365,
        cancellationPolicy: "moderate",
      },
    });

    const booking = await createBookingService(
      {
        product: productId,
        startDate: "2026-06-01T00:00:00.000Z",
        endDate: "2026-06-03T00:00:00.000Z",
        deliveryType: "pickup",
      },
      renter
    );

    assert.equal(booking.status, "pending");
    assert.equal(booking.paymentStatus, "unpaid");

    const confirmed = await updateBookingStatusService(
      booking._id,
      { status: "confirmed" },
      owner
    );
    assert.equal(confirmed.status, "confirmed");

    await assert.rejects(
      () => updateBookingStatusService(booking._id, { status: "active" }, owner),
      (err) =>
        err instanceof AppError &&
        err.statusCode === 400 &&
        err.message.includes("only be marked active after payment")
    );

    const orderId = "order_123";
    const paymentId = "pay_123";
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const paid = await verifyRazorpayPaymentService(
      booking._id,
      {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      },
      renter
    );
    assert.equal(paid.paymentStatus, "paid");

    const active = await updateBookingStatusService(booking._id, { status: "active" }, owner);
    assert.equal(active.status, "active");

    const returnRequested = await updateBookingStatusService(
      booking._id,
      { status: "return_requested" },
      renter
    );
    assert.equal(returnRequested.status, "return_requested");
    assert.ok(returnRequested.returnFlow?.requestedAt);

    const completed = await updateBookingStatusService(
      booking._id,
      { status: "completed" },
      owner
    );
    assert.equal(completed.status, "completed");
    assert.ok(completed.returnFlow?.confirmedAt);
    assert.equal(db.products.get(String(productId)).totalRentals, 1);
  } finally {
    db.restore();
  }
});

addTest("listMyBookings auto-marks overdue active bookings as return_requested", async () => {
  const db = setupDb();
  try {
    const renterId = id("444444444444444444444444");
    const ownerId = id("555555555555555555555555");
    const productId = id("666666666666666666666666");

    db.users.set(String(renterId), makeUser({ _id: renterId, role: ["renter"] }));
    db.users.set(String(ownerId), makeUser({ _id: ownerId, role: ["owner"] }));
    db.products.set(String(productId), {
      _id: productId,
      owner: ownerId,
      title: "Saw",
      status: "active",
      blockedDates: [],
      pricing: { daily: { enabled: true, rate: 900 }, currency: "INR" },
      rentalRules: { minRentalDays: 1, maxRentalDays: 30, advanceBookingDays: 365 },
    });

    const overdueBooking = {
      _id: id("777777777777777777777777"),
      orderCode: "RH-OLD-1",
      product: productId,
      renter: renterId,
      owner: ownerId,
      startDate: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      endDate: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      status: "active",
      pricingUnit: "daily",
      totalDays: 1,
      totalHours: 24,
      totalUnits: 1,
      pricingSnapshot: { totalAmount: 900, currency: "INR", pricingUnit: "daily" },
      paymentStatus: "paid",
      paymentMethod: "razorpay",
      paymentDetails: {},
      returnFlow: {},
      cancellation: {},
    };

    overdueBooking.save = async function save() {
      db.bookings.set(String(this._id), this);
      return this;
    };
    db.bookings.set(String(overdueBooking._id), overdueBooking);

    const result = await listMyBookingsService(String(renterId), {
      as: "renter",
      page: 1,
      limit: 10,
    });

    assert.equal(result.bookings.length, 1);
    assert.equal(result.bookings[0].status, "return_requested");
    assert.ok(result.bookings[0].returnFlow?.requestedAt);
  } finally {
    db.restore();
  }
});

addTest("renter can cancel pending booking", async () => {
  const db = setupDb();
  try {
    const renterId = id("888888888888888888888888");
    const ownerId = id("999999999999999999999999");
    const productId = id("aaaaaaaaaaaaaaaaaaaaaaaa");

    const renter = makeUser({ _id: renterId, role: ["renter"] });
    db.users.set(String(renterId), renter);
    db.users.set(String(ownerId), makeUser({ _id: ownerId, role: ["owner"] }));
    db.products.set(String(productId), {
      _id: productId,
      owner: ownerId,
      title: "Camera",
      status: "active",
      blockedDates: [],
      pricing: { daily: { enabled: true, rate: 1500 }, currency: "INR" },
      rentalRules: {
        minRentalDays: 1,
        maxRentalDays: 30,
        advanceBookingDays: 365,
        cancellationPolicy: "moderate",
      },
    });

    const booking = await createBookingService(
      {
        product: productId,
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-07-02T00:00:00.000Z",
        deliveryType: "pickup",
      },
      renter
    );

    const cancelled = await cancelBookingService(
      booking._id,
      { reason: "Change of plans" },
      renter
    );

    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.cancellation.reason, "Change of plans");
  } finally {
    db.restore();
  }
});

const run = async () => {
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      passed += 1;
      console.log(`PASS: ${test.name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL: ${test.name}`);
      console.error(error);
    }
  }

  console.log(`\nBooking/payment/return smoke tests complete. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
};

run();
