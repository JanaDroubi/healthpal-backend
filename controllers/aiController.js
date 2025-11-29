//aiController
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dayjs = require("dayjs");
const db = require("../config/db");


const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

/**
 * Analyze patient's symptoms using Gemini 1.5 Flash
 * and store structured diagnosis results into ai_medical_analysis table.
 */
const analyzeMedicalSymptomsFast = async (req, res) => {
  try {
    const { user_id, symptoms } = req.body;

    if (!user_id || !symptoms) {
      return res.status(400).send({
        success: false,
        message: "user_id and symptoms are required.",
      });
    }

    // Fetch patient info
    const [patientRows] = await db.query(
      `SELECT gender, dob, chronic_conditions_summary, medical_history 
       FROM patient_profiles 
       WHERE user_id = ?`,
      [user_id]
    );

    if (patientRows.length === 0) {
      return res.status(404).send({
        success: false,
        message: "Patient profile not found.",
      });
    }

    const patient = patientRows[0];
    const age = patient.dob ? dayjs().diff(patient.dob, "year") : "unknown";

    // Prepare prompt for Gemini
    const prompt = `
You are an advanced medical AI assistant.
Your ONLY task is to analyze the given symptoms and produce EXACTLY THREE possible diagnoses in JSON format.

⚠️ Output Rules:
- Respond with PURE JSON only (no explanations, no text, no markdown).
- JSON must be valid and parsable.
- Include three diagnoses, each with "condition" and "confidence" (number between 50–100).
- Include "severity" (LOW | MEDIUM | HIGH).
- Include "recommended_action" (short medical recommendation).

Example:
{
  "diagnoses": [
    {"condition": "Condition 1", "confidence": 85},
    {"condition": "Condition 2", "confidence": 72},
    {"condition": "Condition 3", "confidence": 60}
  ],
  "severity": "MEDIUM",
  "recommended_action": "Rest, hydrate, and seek medical advice if symptoms worsen."
}

Patient Info:
- Gender: ${patient.gender || "N/A"}
- Age: ${age}
- Chronic Conditions: ${patient.chronic_conditions_summary || "None"}
- Medical History: ${patient.medical_history || "No history"}

Symptoms: ${symptoms}
`;

    // Send to Gemini
   const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const result = await model.generateContent(prompt);
    const aiOutput = result.response.text();

    // Parse JSON safely
    let aiResult;
    try {
      const jsonMatch = aiOutput.match(/\{[\s\S]*\}/);
      aiResult = JSON.parse(jsonMatch ? jsonMatch[0] : aiOutput);
    } catch (err) {
      console.warn("⚠️ Invalid JSON from Gemini:", aiOutput);
      return res.status(200).send({
        success: false,
        message: "Gemini returned invalid JSON format.",
        raw_output: aiOutput,
      });
    }

    // Extract details for database
    const severity = aiResult.severity || "LOW";
    const recommended_action = aiResult.recommended_action || null;
    const confidence_score =
      aiResult.diagnoses && aiResult.diagnoses.length
        ? (
            aiResult.diagnoses.reduce((sum, d) => sum + (d.confidence || 0), 0) /
            aiResult.diagnoses.length
          ).toFixed(2)
        : null;

    // Save to DB
    await db.query(
      `INSERT INTO ai_medical_analysis 
       (patient_id, analyzed_by, symptoms, ai_model, diagnoses, severity, recommended_action, confidence_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        req.user?.id || null,
        symptoms,
        "gemini-1.5-flash",
        JSON.stringify(aiResult.diagnoses || []),
        severity,
        recommended_action,
        confidence_score,
      ]
    );

    res.status(200).send({
      success: true,
      message: "AI medical analysis completed and saved successfully.",
      data: {
        patient_overview: { gender: patient.gender, age },
        analysis: aiResult,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: "Error analyzing or saving symptoms result.",
      error: error.message || error,
    });
  }
};

/**
 * Analyze Lab Results using Gemini 1.5 Flash
 */
const analyzeLabResults = async (req, res) => {
  try {
    const { patient_id, test_type, results } = req.body;
    const actor = req.user || {};
    const actorId = actor.id || null;

    if (!patient_id || !test_type || !results) {
      return res.status(400).send({
        success: false,
        message: "patient_id, test_type, and results are required.",
      });
    }

    const cleanedResults = Object.fromEntries(
      Object.entries(results).map(([k, v]) => [k, parseFloat(v) || v])
    );

    const resultsFormatted = Object.entries(cleanedResults)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n");

    const prompt = `
You are a certified medical AI analyzing laboratory results.
Use **standard clinical reference ranges** for adults unless stated otherwise.

Your task:
1. Compare each parameter to its normal range.
2. List all abnormal results.
3. Suggest possible medical causes or conditions (only if clinically relevant).
4. Assign overall SEVERITY: LOW (minor), MEDIUM (needs follow-up), HIGH (urgent).
5. Recommend the next step.

Output MUST be valid JSON.

Format:
{
  "abnormal_results": [{"parameter": "string", "value": number, "issue": "too high/too low"}],
  "possible_conditions": [{"condition": "string", "confidence": 0-100}],
  "severity": "LOW|MEDIUM|HIGH",
  "recommended_action": "short advice"
}

Patient's Lab Test: ${test_type}
Results:
${resultsFormatted}
`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const result = await model.generateContent(prompt);
    const aiOutput = result.response.text();

    // Parse JSON
    let parsedResult;
    try {
      const jsonMatch = aiOutput.match(/\{[\s\S]*\}/);
      parsedResult = JSON.parse(jsonMatch ? jsonMatch[0] : aiOutput);
    } catch {
      return res.status(200).send({
        success: false,
        message: "Gemini returned invalid JSON format.",
        raw_output: aiOutput,
      });
    }

    parsedResult.abnormal_results ||= [];
    parsedResult.possible_conditions ||= [];
    parsedResult.severity ||= "LOW";
    parsedResult.recommended_action ||= "Review results with physician.";

    await db.query(
      `INSERT INTO ai_lab_analysis 
       (patient_id, analyzed_by, test_type, test_data, ai_model, analysis_summary, severity, recommended_action, raw_ai_response)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patient_id,
        actorId,
        test_type,
        JSON.stringify(cleanedResults),
        "gemini-1.5-flash",
        JSON.stringify(parsedResult),
        parsedResult.severity,
        parsedResult.recommended_action,
        aiOutput,
      ]
    );

    res.status(200).send({
      success: true,
      message: "AI lab analysis completed successfully.",
      data: parsedResult,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: "Error analyzing lab results.",
      error: error.message,
    });
  }
};

/**
 * Generate medication and lifestyle suggestions for a diagnosed condition
 */
const generateMedicationSuggestion = async (req, res) => {
  try {
    const { patient_id, diagnosed_condition } = req.body;
    const suggested_by = req.user?.id || null;

    if (!patient_id || !diagnosed_condition) {
      return res.status(400).send({
        success: false,
        message: "patient_id and diagnosed_condition are required.",
      });
    }

    const prompt = `
You are a certified medical AI assistant.
Patient has been diagnosed with: ${diagnosed_condition}

Task:
1. Suggest 1-3 commonly prescribed medications (generic names) with dosage ranges.
2. Include non-drug recommendations (lifestyle, diet).
3. Include a disclaimer: "Always consult your physician before taking any medication."

Output MUST be valid JSON:

{
  "medications": [
    {"name": "string", "dosage": "string", "notes": "string"}
  ],
  "lifestyle_recommendations": ["string"],
  "disclaimer": "string"
}
`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const result = await model.generateContent(prompt);
    const aiOutput = result.response.text();

    let suggestion;
    try {
      const jsonMatch = aiOutput.match(/\{[\s\S]*\}/);
      suggestion = JSON.parse(jsonMatch ? jsonMatch[0] : aiOutput);
    } catch (err) {
      return res.status(200).send({
        success: false,
        message: "AI returned invalid JSON format.",
        raw_output: aiOutput,
      });
    }

    await db.query(
      `INSERT INTO ai_medication_suggestions 
       (patient_id, diagnosed_condition, suggested_medications, lifestyle_recommendations, disclaimer, ai_model, suggested_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        patient_id,
        diagnosed_condition,
        JSON.stringify(suggestion.medications || []),
        JSON.stringify(suggestion.lifestyle_recommendations || []),
        suggestion.disclaimer || "",
        "gemini-2.5-flash-lite",
        suggested_by,
      ]
    );

    res.status(200).send({
      success: true,
      message: "Medication suggestion generated and saved successfully.",
      data: suggestion,
    });

  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: "Error generating or saving medication suggestion.",
      error: error.message || error,
    });
  }
};

module.exports = { analyzeMedicalSymptomsFast, analyzeLabResults, generateMedicationSuggestion };
