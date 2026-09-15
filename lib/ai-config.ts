/**
 * Centralized Google Gemini AI Configuration
 * Modify this file to adjust models, generation settings, or endpoints across the application.
 */

export const AI_CONFIG = {
  // Recommended free-tier model: gemini-3.6-flash (current fast, highly capable production flash model)
  // Can be overridden at runtime via process.env.GEMINI_MODEL
  model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',

  // Generation parameters for a grounded, intelligent assistant
  temperature: 0.3,
  topP: 0.95,
  maxOutputTokens: 2048,

  // Network request timeout in milliseconds (30 seconds)
  timeoutMs: 30000,

  // Google Gemini API base URL
  geminiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
};
