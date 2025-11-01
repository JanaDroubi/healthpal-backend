const db = require("../config/db");
const dayjs = require("dayjs");

/**
 * ============================
 *  Get AI analyses by type (SYMPTOMS, LAB, MEDICATION)
 * ============================
 */
const getAIAnalysesByType = async (req, res) => {
  try {
    // تأكيد تسجيل الدخول
    if (!req.user) {
      return res.status(401).send({
        success: false,
        message: "Unauthorized. Please log in.",
      });
    }

    // التحقق من الرول
    const { role, id: doctorId } = req.user;
    if (role !== "DOCTOR" && role !== "ADMIN") {
      return res.status(403).send({
        success: false,
        message: "Access denied. Doctor or Admin role required.",
      });
    }

    // جلب نوع التحليل من الـ URL
    const { type } = req.params;
    const analysisType = type?.toUpperCase();

    if (!["SYMPTOMS", "LAB", "MEDICATION"].includes(analysisType)) {
      return res.status(400).send({
        success: false,
        message: "Invalid analysis type. Must be one of: SYMPTOMS, LAB, MEDICATION.",
      });
    }

    let rows = [];

    // 🔹 الحالة 1: تحليلات الأعراض
    if (analysisType === "SYMPTOMS") {
      [rows] = await db.query(`
        SELECT 
          a.id,
          'SYMPTOMS' AS analysis_type,
          a.created_at,
          a.symptoms AS input_data,
          a.diagnoses AS ai_result,
          a.severity,
          a.recommended_action,
          a.confidence_score,
          u_patient.full_name AS patient_name,
          a.ai_model,
          u_analyzer.full_name AS analyzed_by
        FROM ai_medical_analysis a
        JOIN patient_profiles p ON a.patient_id = p.user_id
        JOIN user u_patient ON p.user_id = u_patient.user_id
        LEFT JOIN user u_analyzer ON a.analyzed_by = u_analyzer.user_id
        ORDER BY a.created_at DESC
      `);
    }

    // 🔹 الحالة 2: تحاليل المختبر
    if (analysisType === "LAB") {
      [rows] = await db.query(`
        SELECT 
          a.id,
          'LAB' AS analysis_type,
          a.created_at,
          a.test_type AS input_data,
          a.analysis_summary AS ai_result,
          a.severity,
          a.recommended_action,
          a.confidence_score,
          u_patient.full_name AS patient_name,
          a.ai_model,
          u_analyzer.full_name AS analyzed_by
        FROM ai_lab_analysis a
        JOIN patient_profiles p ON a.patient_id = p.user_id
        JOIN user u_patient ON p.user_id = u_patient.user_id
        LEFT JOIN user u_analyzer ON a.analyzed_by = u_analyzer.user_id
        ORDER BY a.created_at DESC
      `);
    }

    // 🔹 الحالة 3: اقتراحات الأدوية
    if (analysisType === "MEDICATION") {
      [rows] = await db.query(`
        SELECT 
          a.id,
          'MEDICATION' AS analysis_type,
          a.created_at,
          a.diagnosed_condition AS input_data,
          JSON_OBJECT(
            'medications', a.suggested_medications,
            'lifestyle', a.lifestyle_recommendations,
            'disclaimer', a.disclaimer
          ) AS ai_result,
          NULL AS severity,
          NULL AS recommended_action,
          NULL AS confidence_score,
          u_patient.full_name AS patient_name,
          a.ai_model,
          u_analyzer.full_name AS analyzed_by
        FROM ai_medication_suggestions a
        JOIN patient_profiles p ON a.patient_id = p.user_id
        JOIN user u_patient ON p.user_id = u_patient.user_id
        LEFT JOIN user u_analyzer ON a.suggested_by = u_analyzer.user_id
        ORDER BY a.created_at DESC
      `);
    }

    res.status(200).send({
      success: true,
      message: `AI analyses of type ${analysisType} fetched successfully.`,
      total: rows.length,
      data: rows,
    });

  } catch (error) {
    console.error("Error fetching AI analyses by type:", error);
    res.status(500).send({
      success: false,
      message: "Error fetching AI analyses.",
      error: error.message || error,
    });
  }
};




/**
 * ============================
 *  Doctor: View specific AI analysis details
 * ============================
 */
const getAIAnalysisDetails = async (req, res) => {
  try {
    // التحقق من تسجيل الدخول
    if (!req.user) {
      return res.status(401).send({
        success: false,
        message: "Unauthorized. Please log in.",
      });
    }

    // التحقق من الصلاحيات
    const { role } = req.user;
    if (role !== "DOCTOR" && role !== "ADMIN") {
      return res.status(403).send({
        success: false,
        message: "Access denied. Doctor or Admin role required.",
      });
    }

    // قراءة النوع والمعرّف من الـ URL
    const { type, id } = req.params;
    const analysisType = type?.toUpperCase();

    if (!["SYMPTOMS", "LAB", "MEDICATION"].includes(analysisType)) {
      return res.status(400).send({
        success: false,
        message: "Invalid analysis type. Must be one of: SYMPTOMS, LAB, MEDICATION.",
      });
    }

    let query = "";
    let rows = [];

    // 🔹 الحالة 1: تحليل أعراض
    if (analysisType === "SYMPTOMS") {
      query = `
        SELECT 
          a.id,
          'SYMPTOMS' AS analysis_type,
          a.created_at,
          a.symptoms AS input_data,
          a.diagnoses AS ai_result,
          a.severity,
          a.recommended_action,
          a.confidence_score,
          u_patient.full_name AS patient_name,
          a.ai_model,
          u_analyzer.full_name AS analyzed_by
        FROM ai_medical_analysis a
        JOIN patient_profiles p ON a.patient_id = p.user_id
        JOIN user u_patient ON p.user_id = u_patient.user_id
        LEFT JOIN user u_analyzer ON a.analyzed_by = u_analyzer.user_id
        WHERE a.id = ?;
      `;
    }

    // 🔹 الحالة 2: تحليل مختبر
    if (analysisType === "LAB") {
      query = `
        SELECT 
          a.id,
          'LAB' AS analysis_type,
          a.created_at,
          a.test_type AS input_data,
          a.analysis_summary AS ai_result,
          a.severity,
          a.recommended_action,
          a.confidence_score,
          u_patient.full_name AS patient_name,
          a.ai_model,
          u_analyzer.full_name AS analyzed_by
        FROM ai_lab_analysis a
        JOIN patient_profiles p ON a.patient_id = p.user_id
        JOIN user u_patient ON p.user_id = u_patient.user_id
        LEFT JOIN user u_analyzer ON a.analyzed_by = u_analyzer.user_id
        WHERE a.id = ?;
      `;
    }

    // 🔹 الحالة 3: اقتراحات أدوية
    if (analysisType === "MEDICATION") {
      query = `
        SELECT 
          a.id,
          'MEDICATION' AS analysis_type,
          a.created_at,
          a.diagnosed_condition AS input_data,
          JSON_OBJECT(
            'medications', a.suggested_medications,
            'lifestyle', a.lifestyle_recommendations,
            'disclaimer', a.disclaimer
          ) AS ai_result,
          NULL AS severity,
          NULL AS recommended_action,
          NULL AS confidence_score,
          u_patient.full_name AS patient_name,
          a.ai_model,
          u_analyzer.full_name AS analyzed_by
        FROM ai_medication_suggestions a
        JOIN patient_profiles p ON a.patient_id = p.user_id
        JOIN user u_patient ON p.user_id = u_patient.user_id
        LEFT JOIN user u_analyzer ON a.suggested_by = u_analyzer.user_id
        WHERE a.id = ?;
      `;
    }

    [rows] = await db.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).send({
        success: false,
        message: `No ${analysisType} analysis found with ID ${id}.`,
      });
    }

    res.status(200).send({
      success: true,
      message: `AI ${analysisType} analysis details fetched successfully.`,
      data: rows[0],
    });

  } catch (error) {
    console.error("Error fetching AI analysis details:", error);
    res.status(500).send({
      success: false,
      message: "Error fetching AI analysis details.",
      error: error.message || error,
    });
  }
};



/**
 * ============================
 *  Doctor: Submit Review
 * ============================
 */
const reviewAIAnalysis = async (req, res) => {
  try {
    // التأكد من تسجيل الدخول
    if (!req.user) {
      return res.status(401).send({
        success: false,
        message: "Unauthorized. Please log in.",
      });
    }

    const { role, id: doctorId } = req.user;

    // التحقق من أن المستخدم دكتور أو أدمن
    if (role !== "DOCTOR" && role !== "ADMIN") {
      return res.status(403).send({
        success: false,
        message: "Access denied. Doctor or Admin role required.",
      });
    }

    // البيانات القادمة من الـ body
    const {
      analysis_type,
      analysis_id,
      doctor_feedback,
      final_decision,
      final_recommendation,
      doctor_confidence,
    } = req.body;

    // تحقق من وجود الحقول الأساسية
    if (!analysis_type || !analysis_id || !doctor_feedback) {
      return res.status(400).send({
        success: false,
        message: "Missing required fields: analysis_type, analysis_id, doctor_feedback.",
      });
    }

    // تأكيد أن النوع صحيح
    const validTypes = ["SYMPTOMS", "LAB", "MEDICATION"];
    if (!validTypes.includes(analysis_type.toUpperCase())) {
      return res.status(400).send({
        success: false,
        message: `Invalid analysis_type. Must be one of: ${validTypes.join(", ")}.`,
      });
    }

    // إدخال المراجعة في جدول ai_doctor_review
    await db.query(
      `
      INSERT INTO ai_doctor_review 
      (analysis_type, analysis_id, doctor_id, doctor_feedback, final_decision, final_recommendation, doctor_confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        analysis_type.toUpperCase(),
        analysis_id,
        doctorId,
        doctor_feedback,
        final_decision || "REVIEWED",
        final_recommendation || null,
        doctor_confidence || null,
      ]
    );

    res.status(200).send({
      success: true,
      message: "Doctor review submitted successfully.",
      data: {
        analysis_type,
        analysis_id,
        doctor_id: doctorId,
        final_decision: final_decision || "REVIEWED",
      },
    });
  } catch (error) {
    console.error("Error submitting doctor review:", error);
    res.status(500).send({
      success: false,
      message: "Error submitting doctor review.",
      error: error.message || error,
    });
  }
};



/**
 * ============================
 *  Patient: View all AI results + doctor feedback
 * ============================
 */
const getPatientAIResults = async (req, res) => {
  try {
    // ✅ التحقق من تسجيل الدخول
    if (!req.user) {
      return res.status(401).send({
        success: false,
        message: "Unauthorized. Please log in.",
      });
    }

    // ✅ استخراج بيانات من URL
    const { patient_id, type } = req.params;
    const analysisType = type?.toUpperCase();

    // ✅ تحقق من نوع التحليل
    if (!["SYMPTOMS", "LAB", "MEDICATION"].includes(analysisType)) {
      return res.status(400).send({
        success: false,
        message: "Invalid analysis type. Must be one of: SYMPTOMS, LAB, MEDICATION.",
      });
    }

    // ✅ تحقق من الصلاحية
    const { role, id: userId } = req.user;
    if (role === "PATIENT" && userId != patient_id) {
      return res.status(403).send({
        success: false,
        message: "Access denied. You can only view your own AI analyses.",
      });
    }

    let rows = [];

    // 🔹 الحالة 1: تحليل الأعراض (SYMPTOMS)
    if (analysisType === "SYMPTOMS") {
      [rows] = await db.query(`
        SELECT 
          a.id,
          'SYMPTOMS' AS analysis_type,
          a.created_at,
          a.symptoms AS input_data,
          a.diagnoses AS ai_result,
          a.severity,
          a.recommended_action,
          a.confidence_score,
          a.ai_model,
          COALESCE(u_analyzer.full_name, 'AI Model') AS analyzed_by,
          r.doctor_feedback,
          r.final_decision,
          r.final_recommendation,
          r.doctor_confidence,
          u_doctor.full_name AS reviewed_by
        FROM ai_medical_analysis a
        LEFT JOIN user u_analyzer ON a.analyzed_by = u_analyzer.user_id
        LEFT JOIN ai_doctor_review r 
          ON r.analysis_type = 'SYMPTOMS' AND r.analysis_id = a.id
        LEFT JOIN user u_doctor ON r.doctor_id = u_doctor.user_id
        WHERE a.patient_id = ?
        ORDER BY a.created_at DESC
      `, [patient_id]);
    }

    // 🔹 الحالة 2: تحليل مختبر (LAB)
    if (analysisType === "LAB") {
      [rows] = await db.query(`
        SELECT 
          a.id,
          'LAB' AS analysis_type,
          a.created_at,
          a.test_type AS input_data,
          a.analysis_summary AS ai_result,
          a.severity,
          a.recommended_action,
          a.confidence_score,
          a.ai_model,
          COALESCE(u_analyzer.full_name, 'AI Model') AS analyzed_by,
          r.doctor_feedback,
          r.final_decision,
          r.final_recommendation,
          r.doctor_confidence,
          u_doctor.full_name AS reviewed_by
        FROM ai_lab_analysis a
        LEFT JOIN user u_analyzer ON a.analyzed_by = u_analyzer.user_id
        LEFT JOIN ai_doctor_review r 
          ON r.analysis_type = 'LAB' AND r.analysis_id = a.id
        LEFT JOIN user u_doctor ON r.doctor_id = u_doctor.user_id
        WHERE a.patient_id = ?
        ORDER BY a.created_at DESC
      `, [patient_id]);
    }

    // 🔹 الحالة 3: اقتراح أدوية (MEDICATION)
    if (analysisType === "MEDICATION") {
      [rows] = await db.query(`
        SELECT 
          a.id,
          'MEDICATION' AS analysis_type,
          a.created_at,
          a.diagnosed_condition AS input_data,
          JSON_OBJECT(
            'medications', a.suggested_medications,
            'lifestyle', a.lifestyle_recommendations,
            'disclaimer', a.disclaimer
          ) AS ai_result,
          NULL AS severity,
          NULL AS recommended_action,
          NULL AS confidence_score,
          a.ai_model,
          COALESCE(u_suggester.full_name, 'AI Model') AS analyzed_by,
          r.doctor_feedback,
          r.final_decision,
          r.final_recommendation,
          r.doctor_confidence,
          u_doctor.full_name AS reviewed_by
        FROM ai_medication_suggestions a
        LEFT JOIN user u_suggester ON a.suggested_by = u_suggester.user_id
        LEFT JOIN ai_doctor_review r 
          ON r.analysis_type = 'MEDICATION' AND r.analysis_id = a.id
        LEFT JOIN user u_doctor ON r.doctor_id = u_doctor.user_id
        WHERE a.patient_id = ?
        ORDER BY a.created_at DESC
      `, [patient_id]);
    }

    res.status(200).send({
      success: true,
      message: `AI ${analysisType} analyses with doctor reviews fetched successfully.`,
      total: rows.length,
      data: rows,
    });

  } catch (error) {
    console.error("Error fetching patient AI results:", error);
    res.status(500).send({
      success: false,
      message: "Error fetching patient AI results.",
      error: error.message || error,
    });
  }
};


module.exports = {
  getAIAnalysesByType,
  getAIAnalysisDetails,
  reviewAIAnalysis,
  getPatientAIResults
};
