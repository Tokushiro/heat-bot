import "./config/env";
import express from "express";
import { createServer } from "http";
import cors from "cors";
import sensorsRouter from "./routes/sensor_routes";
import testChoiceRouter from "./routes/test_choice_rotues";
import testRouter from "./routes/test_routes";
import serialRouter from "./routes/serial_manager_routes";
import sensorEventsRouter from "./routes/sensorEvents_routes";
import testExecutionRouter from "./routes/test_execution_routes";
import websocketService from "./services/websocket_service";

const serverIP = process.env.SERVER_IP;
console.log("Loaded SERVER_IP:", process.env.SERVER_IP);

const app = express();
const httpServer = createServer(app);

app.use(cors({
    origin: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        `http://${serverIP}:5173`, // PC LAN IP with Vite port
    ],
    methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
    allowedHeaders: ["Content-Type","Authorization"],
    credentials: true,
}));

app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Routes
app.use("/api/sensors", sensorsRouter);
app.use("/api/testchoice", testChoiceRouter);
app.use("/api/test", testRouter);
app.use("/api/serial", serialRouter);
app.use("/api", sensorEventsRouter);
app.use("/api/test-execution", testExecutionRouter);

// Initialize SSE stream for real-time events
websocketService.initialize(app);

const PORT = Number(process.env.SERVER_PORT ?? 3000);

// Bind to 0.0.0.0 so other devices can reach it
httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 API listening on http://0.0.0.0:${PORT}`);
    console.log(`🔌 SSE stream available at http://0.0.0.0:${PORT}/ws`);
});
