// Dependencies
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client using environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize app and middleware
const app = express();
app.use(bodyParser.json());

// Helper function to generate a random token
function generateToken() {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Endpoint: Register a new IoT device
 * Method: POST
 * URL: /register-device
 * Body: { deviceId: string }
 */
app.post("/register-device", async (req, res) => {
  const { deviceId } = req.body;

  if (!deviceId) {
    return res.status(400).json({ error: "Device ID is required." });
  }

  // Check if device already exists
  const { data: existingDevice, error: fetchError } = await supabase
    .from("devicesTable")
    .select("*")
    .eq("device_id", deviceId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    console.log(fetchError);
    return res.status(500).json({ error: "Error checking device existence." });
  }

  if (existingDevice) {
    return res.status(400).json({ error: "Device ID is already registered." });
  }

  // Register new device
  const token = generateToken();
  const { error: insertError } = await supabase
    .from("devicesTable")
    .insert([{ device_id: deviceId, token }]);

  if (insertError) {
    console.log(insertError);
    return res.status(500).json({ error: "Error registering device." });
  }

  res
    .status(201)
    .json({ message: "Device registered successfully.", deviceId, token });
});

/**
 * Middleware: Authenticate device using deviceId and token
 */
async function authenticateDevice(req, res, next) {
  const { device, token } = req.headers;

  if (!device || !token) {
    return res.status(401).json({ error: "Device ID and token are required." });
  }

  // Validate device and token
  const { data: deviceRecord, error } = await supabase
    .from("devicesTable")
    .select("*")
    .eq("device_id", device)
    .eq("token", token)
    .single();

  if (error || !deviceRecord) {
    return res
      .status(403)
      .json({ error: "Invalid token or unauthorized device." });
  }

  next();
}

/**
 * Endpoint: Secure data upload
 * Method: POST
 * URL: /upload-data
 * Headers: { deviceId: string, token: string }
 * Body: { data: any }
 */
app.post("/upload-data", authenticateDevice, (req, res) => {
  const { data } = req.body;

  if (!data) {
    return res.status(400).json({ error: "Data is required for upload." });
  }

  console.log(`Data received from ${req.headers.device}:`, data);
  res.status(200).json({ message: "Data uploaded successfully." });
});

/**
 * Endpoint: List all registered devices
 * Method: GET
 * URL: /list-devices
 */
app.get("/list-devices", async (req, res) => {
  const { data: devices, error } = await supabase
    .from("devicesTable")
    .select("*");

  if (error) {
    console.error("Error fetching devices:", error.message);
    return res.status(500).json({ error: "Error fetching device list." });
  }

  console.log("Devices fetched from Supabase:", devices); // Debug log
  res.status(200).json({ devices });
});

/**
 * Endpoint: Health check for server
 * Method: GET
 * URL: /health
 */
app.get("/health", (req, res) => {
  res.status(200).json({ message: "Server is up and running." });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
