import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '2mb' }));

// Explicit route for sitemap.xml to guarantee application/xml Content-Type
app.get('/sitemap.xml', (req, res) => {
  res.header('Content-Type', 'application/xml; charset=utf-8');
  res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

// Endpoint for Dynamic Firebase Configuration
app.get('/api/firebase-config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  });
});

let aiClient = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Endpoint for Gemini AI Performance Analysis & Report Card
app.post('/api/analyze-performance', async (req, res) => {
  try {
    const { stats, history, mistakes } = req.body || {};

    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({
        success: false,
        error: "GEMINI_API_KEY_MISSING",
        message: "Gemini API Key is not configured in server environment. Please set GEMINI_API_KEY to unlock AI diagnostics."
      });
    }

    const ai = getGeminiClient();

    const prompt = `
You are an expert Computer Science & Digital Logic Design tutor.
Analyze the following student performance data from a Number System Trainer platform (Binary, Octal, Hexadecimal arithmetic and base conversions):

STUDENT OVERVIEW:
- Total Points: ${stats?.points || 0}
- Current Streak: ${stats?.currentStreak || 0}
- Max Streak: ${stats?.maxStreak || 0}
- Arithmetic Solved: ${stats?.arithmetic || 0}
- Base Conversions Solved: ${stats?.conversions || 0}
- Errors Count: ${stats?.errors || 0}
- Overall Accuracy: ${stats?.accuracy || 0}%

RECENT MISTAKES NOTEBOOK (${(mistakes || []).length} items):
${JSON.stringify((mistakes || []).slice(0, 15), null, 2)}

RECENT QUESTION HISTORY (${(history || []).length} items):
${JSON.stringify((history || []).slice(0, 20), null, 2)}

Generate a detailed student report card and diagnostic analysis in JSON format with the exact keys:
{
  "grade": "A+" | "A" | "B" | "C" | "D" | "F",
  "summary": "2-3 sentences evaluating current skill level across arithmetic and base conversions.",
  "strengths": [
    "Highlight specific operations or bases where accuracy is highest"
  ],
  "areasForImprovement": [
    "Highlight specific bases, conversion types, or bit lengths needing practice"
  ],
  "mistakePatternAnalysis": {
    "sillyMistakes": "Analysis of typos, off-by-one errors, or rushed answers",
    "conceptualFlaws": "Analysis of carry/borrow propagation, 2's complement, or conversion formulas",
    "speedVsAccuracy": "Analysis of response time vs accuracy"
  },
  "actionableTips": [
    "Actionable tip 1",
    "Actionable tip 2",
    "Actionable tip 3"
  ]
}
`;

    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-3.6-flash'];
    let lastError = null;
    let response = null;

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          }
        });
        if (response && response.text) break;
      } catch (e) {
        lastError = e;
        console.warn(`Model ${modelName} call failed (${e.message}), trying next model...`);
        continue;
      }
    }

    if (!response || !response.text) {
      if (lastError && (lastError.message.includes('429') || lastError.message.includes('quota') || lastError.message.includes('RESOURCE_EXHAUSTED'))) {
        return res.status(200).json({
          success: false,
          error: "RATE_LIMIT_EXHAUSTED",
          message: "Gemini API quota exceeded. Falling back to internal engine."
        });
      }
      throw lastError || new Error("Failed to generate AI report");
    }

    const reportData = JSON.parse(response.text);
    return res.json({ success: true, report: reportData });
  } catch (err) {
    if (err.message && (err.message.includes('429') || err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED'))) {
      return res.status(200).json({
        success: false,
        error: "RATE_LIMIT_EXHAUSTED",
        message: "Gemini API quota exceeded. Falling back to internal engine."
      });
    }
    console.error("Gemini Analytics API Error:", err.message);
    return res.status(500).json({
      success: false,
      error: "AI_GENERATION_FAILED",
      details: err.message
    });
  }
});

// Endpoint for Admin Gemini AI Class-wide Cohort Diagnostic Analysis
app.post('/api/analyze-cohort', async (req, res) => {
  try {
    const { cohortData } = req.body || {};
    if (!cohortData) {
      return res.status(400).json({ success: false, error: "Cohort data payload is required." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({
        success: false,
        error: "GEMINI_API_KEY_MISSING",
        message: "Gemini API Key is missing from server environment."
      });
    }

    const ai = getGeminiClient();

    const prompt = `
You are an expert Computer Science Professor and Educational Data Analytics Specialist.
Analyze the following aggregated CLASS-WIDE cohort performance data from the Number System Trainer platform across all enrolled students:

COHORT OVERVIEW STATS:
- Total Students Enrolled: ${cohortData.totalStudents || 0}
- Total Questions Solved across Class: ${cohortData.totalQuestionsSolved || 0}
- Class Average Accuracy: ${cohortData.classAverageAccuracy || 0}%
- Class Average Digital Points: ${cohortData.classAveragePoints || 0}
- Performance Tier Distribution:
  * High Performers (>=80% accuracy): ${cohortData.performanceDistribution?.highPerformers || 0}
  * Developing Performers (50-79% accuracy): ${cohortData.performanceDistribution?.moderatePerformers || 0}
  * Needing Intervention (<50% accuracy): ${cohortData.performanceDistribution?.strugglingStudents || 0}

TOPIC PERFORMANCE BREAKDOWN ACROSS CLASS:
${JSON.stringify(cohortData.topicBreakdown || [], null, 2)}

MOST FREQUENT MISTAKE PATTERNS ACROSS ALL STUDENTS:
${JSON.stringify((cohortData.commonMistakes || []).slice(0, 20), null, 2)}

TIME & PACING METRICS:
${JSON.stringify(cohortData.timePacingMetrics || {}, null, 2)}

Generate a comprehensive Admin Executive Cohort Report in JSON format with the exact keys:
{
  "healthGrade": "A+" | "A" | "B" | "C" | "D" | "F",
  "executiveSummary": "A concise 3-4 sentence macro analysis evaluating overall class mastery, participation, and major trends.",
  "topStrugglingAreas": [
    "Specific topics, bases, or conversion types where the majority of students struggle"
  ],
  "commonLogicFlaws": [
    "Detailed diagnosis of recurring cognitive or procedural flaws (e.g., carry propagation, sign extension, hex fractional conversion, MSB bit flip)"
  ],
  "pacingAndTimeBottlenecks": "Detailed analysis of student response times, slowest problem types, and speed-accuracy trade-offs.",
  "commonMistakesBreakdown": [
    "Categorized summary of frequent mistakes across the cohort"
  ],
  "pedagogicalRecommendations": [
    "Actionable teaching strategy 1",
    "Actionable teaching strategy 2",
    "Actionable teaching strategy 3"
  ]
}
`;

    const modelsToTry = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.1-pro-preview'];
    let lastError = null;
    let response = null;

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          }
        });
        if (response && response.text) break;
      } catch (e) {
        lastError = e;
        console.warn(`Model ${modelName} call failed for cohort analysis (${e.message}), trying next model...`);
        continue;
      }
    }

    if (!response || !response.text) {
      if (lastError && (lastError.message.includes('429') || lastError.message.includes('quota') || lastError.message.includes('RESOURCE_EXHAUSTED'))) {
        return res.status(200).json({
          success: false,
          error: "RATE_LIMIT_EXHAUSTED",
          message: "Gemini API quota exceeded. Falling back to local cohort diagnostic engine."
        });
      }
      throw lastError || new Error("Failed to generate cohort AI report");
    }

    const reportData = JSON.parse(response.text);
    return res.json({ success: true, report: reportData });
  } catch (err) {
    if (err.message && (err.message.includes('429') || err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED'))) {
      return res.status(200).json({
        success: false,
        error: "RATE_LIMIT_EXHAUSTED",
        message: "Gemini API quota exceeded. Falling back to local cohort diagnostic engine."
      });
    }
    console.error("Gemini Cohort Analytics API Error:", err.message);
    return res.status(500).json({
      success: false,
      error: "AI_COHORT_GENERATION_FAILED",
      details: err.message
    });
  }
});

// Endpoint for Gemini AI Step-by-Step Question Solution Generation
app.post('/api/solve', async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ success: false, error: "Prompt is required." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({
        success: false,
        error: "GEMINI_API_KEY_MISSING",
        message: "Gemini API Key is not configured in server environment."
      });
    }

    const ai = getGeminiClient();
    const modelsToTry = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.1-pro-preview'];
    let lastError = null;
    let response = null;

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
        });
        if (response && response.text) break;
      } catch (e) {
        lastError = e;
        console.warn(`Model ${modelName} call failed (${e.message}), trying next model...`);
        continue;
      }
    }

    if (!response || !response.text) {
      if (lastError && (lastError.message.includes('429') || lastError.message.includes('quota') || lastError.message.includes('RESOURCE_EXHAUSTED'))) {
        return res.status(200).json({
          success: false,
          error: "RATE_LIMIT_EXHAUSTED",
          message: "Gemini API quota exceeded."
        });
      }
      throw lastError || new Error("Failed to generate AI solution");
    }

    return res.json({ success: true, solution: response.text });
  } catch (err) {
    if (err.message && (err.message.includes('429') || err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED'))) {
      return res.status(200).json({
        success: false,
        error: "RATE_LIMIT_EXHAUSTED",
        message: "Gemini API quota exceeded."
      });
    }
    console.error("Gemini Solve API Error:", err.message);
    return res.status(500).json({
      success: false,
      error: "AI_SOLVE_FAILED",
      details: err.message
    });
  }
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

