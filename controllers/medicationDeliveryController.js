const db = require("../config/db");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
dayjs.extend(customParseFormat);

const ACTIVE_PATIENT_STATUSES = ["ACTIVE"];
const ACTIVE_NGO_STATUSES = ["VERIFIED"];

// Ensure user exists and role is correct
async function ensureUser(id, role, mustBeActive = true) {
  const [[u]] = await db.query(
    "SELECT user_id, role, status FROM `user` WHERE user_id = ? LIMIT 1",
    [id]
  );
  if (!u) return { ok: false, code: 404, msg: "User not found." };
  if (String(u.role || "").toUpperCase() !== role.toUpperCase())
    return { ok: false, code: 403, msg: `Target user is not a ${role}.` };
  if (
    mustBeActive &&
    !ACTIVE_PATIENT_STATUSES.includes(String(u.status || "").toUpperCase())
  )
    return { ok: false, code: 403, msg: `User is not ACTIVE.` };
  return { ok: true, user: u };
}

// List Pending Medication Requests
const listPendingMedicationRequests = async (req, res) => {
  try {
    const actor = req.user || {};
    const actorRole = String(actor.role || "").toUpperCase();

    // Only PATIENT, VOLUNTEER, NGO, or ADMIN can see requests
    if (!["PATIENT", "VOLUNTEER", "NGO", "ADMIN"].includes(actorRole)) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied." });
    }

    let { status, from, to, limit = "100", offset = "0", item_id } = req.query;
    limit = Math.min(parseInt(limit, 10) || 100, 500);
    offset = Math.max(parseInt(offset, 10) || 0, 0);

    const whereParts = ['sr.status = "PENDING"'];
    const params = [];

    if (item_id) {
      whereParts.push("sr.item_id = ?");
      params.push(item_id);
    }

    if (from) {
      const f = dayjs(from, ["YYYY-MM-DD"], true);
      if (!f.isValid())
        return res
          .status(400)
          .json({ success: false, message: "Invalid from date." });
      whereParts.push("sr.created_at >= ?");
      params.push(f.startOf("day").format("YYYY-MM-DD HH:mm:ss"));
    }

    if (to) {
      const t = dayjs(to, ["YYYY-MM-DD"], true);
      if (!t.isValid())
        return res
          .status(400)
          .json({ success: false, message: "Invalid to date." });
      whereParts.push("sr.created_at <= ?");
      params.push(t.endOf("day").format("YYYY-MM-DD HH:mm:ss"));
    }

    const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const [rows] = await db.query(
      `SELECT 
         sr.id AS request_id,
         sr.requester_id,
         sr.item_id,
         sr.quantity,
         sr.urgency_level,
         sr.notes,
         sr.status,
         sr.created_at,
         p.city AS patient_city,
         i.name AS item_name,
         i.unit AS item_unit
       FROM supply_requests sr
       JOIN patient_profiles p ON p.user_id = sr.requester_id
       JOIN items i ON i.id = sr.item_id
       ${where}
       ORDER BY sr.urgency_level DESC, sr.created_at ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Fetch matching inventory for each request
    for (let request of rows) {
      const [stock] = await db.query(
        `SELECT id AS inventory_id, owner_id, quantity_available, location_city
           FROM medication_inventory
          WHERE item_id = ? AND quantity_available >= ? AND verified = 1
          ORDER BY expiration_date ASC`,
        [request.item_id, request.quantity]
      );
      request.available_stock = stock;
    }

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Error fetching medication requests.",
      error: err,
    });
  }
};

// Fulfill Medication Request
const fulfillMedicationRequest = async (req, res) => {
  let conn;
  try {
    const { request_id, provider_user_id, inventory_id, quantity } = req.body;
    const actor = req.user || {};
    const actorRole = String(actor.role || "").toUpperCase();

    // 👇 التحقق من أن المنفذ هو VOLUNTEER أو NGO فقط
    if (!["VOLUNTEER", "NGO"].includes(actorRole)) {
      return res.status(403).json({
        success: false,
        message: "Only VOLUNTEER or NGO can fulfill requests.",
      });
    }

    // 👇 التأكد من وجود المزوّد في النظام
    const okProvider = await ensureUser(provider_user_id, actorRole, true);
    if (!okProvider.ok)
      return res
        .status(okProvider.code)
        .json({ success: false, message: okProvider.msg });

    // 👇 بدء المعاملة
    conn = await db.getConnection();
    await conn.beginTransaction();

    // 🔒 قفل الطلب أثناء المعالجة
    const [reqRows] = await conn.query(
      "SELECT * FROM supply_requests WHERE id = ? FOR UPDATE",
      [request_id]
    );

    if (reqRows.length === 0) {
      await conn.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Request not found." });
    }

    const request = reqRows[0];

    if (request.status !== "PENDING") {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: "Request already fulfilled or matched.",
      });
    }

    // 🔒 قفل المخزون أثناء التحديث
    const [invRows] = await conn.query(
      "SELECT * FROM medication_inventory WHERE id = ? FOR UPDATE",
      [inventory_id]
    );

    if (invRows.length === 0 || invRows[0].quantity_available < quantity) {
      await conn.rollback();
      return res
        .status(409)
        .json({ success: false, message: "Insufficient stock." });
    }

    // ✅ إدخال سجل جديد في جدول fulfillments
    await conn.query(
      `INSERT INTO fulfillments (request_id, provider_user_id, provided_qty, status)
       VALUES (?, ?, ?, 'OUT_FOR_DELIVERY')`,
      [request_id, provider_user_id, quantity]
    );

    // ✅ تحديث حالة الطلب إلى MATCHED
    await conn.query(
      `UPDATE supply_requests SET status = 'MATCHED' WHERE id = ?`,
      [request_id]
    );

    // ✅ تحديث كمية المخزون
    await conn.query(
      `UPDATE medication_inventory SET quantity_available = quantity_available - ? WHERE id = ?`,
      [quantity, inventory_id]
    );

    // ✅ حفظ المعاملة
    await conn.commit();

    // ✅ جلب بيانات الـ fulfillment الجديدة مع اسم المريض الصحيح من جدول user
    const [[fulfillment]] = await db.query(
      `SELECT 
          f.*,
          i.name AS item_name,
          u.full_name AS patient_name,
          sr.notes,
          sr.urgency_level,
          sr.status AS request_status
       FROM fulfillments f
       JOIN supply_requests sr ON sr.id = f.request_id
       JOIN items i ON i.id = sr.item_id
       JOIN user u ON u.user_id = sr.requester_id
      WHERE f.request_id = ?`,
      [request_id]
    );

    return res.status(201).json({
      success: true,
      message: "Request matched and fulfillment created successfully.",
      data: fulfillment,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("❌ Error fulfilling request:", err);
    return res.status(500).json({
      success: false,
      message: "Error fulfilling request.",
      error: err.message,
    });
  } finally {
    if (conn) conn.release();
  }
};

// Cancel Fulfillment (by patient/admin)
const cancelMedicationRequest = async (req, res) => {
  let conn;
  try {
    const { request_id } = req.params;
    const actor = req.user || {};
    const actorRole = String(actor.role || "").toUpperCase();

    // Fetch request
    const [[request]] = await db.query(
      "SELECT * FROM supply_requests WHERE id = ?",
      [request_id]
    );
    if (!request)
      return res
        .status(404)
        .json({ success: false, message: "Request not found." });

    if (
      !["PATIENT", "ADMIN"].includes(actorRole) ||
      (actorRole === "PATIENT" && actor.id !== request.requester_id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this request.",
      });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Only PENDING requests can be cancelled.",
      });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    await conn.query(
      'UPDATE supply_requests SET status = "CANCELLED" WHERE id = ?',
      [request_id]
    );

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: "Medication request cancelled successfully.",
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Error cancelling request.",
      error: err,
    });
  } finally {
    if (conn) conn.release();
  }
};

// Get a single request by ID
const getMedicationRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT sr.*, u.full_name AS patient_name, i.name AS item_name
       FROM supply_requests sr
       JOIN user u ON u.user_id = sr.requester_id
       JOIN items i ON i.id = sr.item_id
       WHERE sr.id = ?`,
      [id]
    );

    if (rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Request not found." });

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Error fetching request",
      error: err,
    });
  }
};

// Get requests by patient
const getRequestsByPatient = async (req, res) => {
  try {
    const { patient_id } = req.params;

    // جلب كل طلبات المريض مع اسم الصنف
    const [rows] = await db.query(
      `SELECT sr.*, i.name AS item_name
       FROM supply_requests sr
       JOIN items i ON i.id = sr.item_id
       WHERE sr.requester_id = ?`,
      [patient_id]
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          message: "No requests found for this patient.",
        });
    }

    return res
      .status(200)
      .json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Error fetching patient requests",
      error: err,
    });
  }
};

module.exports = {
  listPendingMedicationRequests,
  fulfillMedicationRequest,
  cancelMedicationRequest,
  getMedicationRequestById,
  getRequestsByPatient,
};
