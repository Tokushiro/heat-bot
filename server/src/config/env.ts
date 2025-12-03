import dotenv from "dotenv";
import path from "path";

// Load environment variables from project root .env if present
// This module should be imported before any code that relies on process.env
// to ensure configuration values are available during module initialization.
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });
