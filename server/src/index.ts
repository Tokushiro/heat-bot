import express from "express";
import cors from "cors";
import sensorsRouter from "./routes/sensor/sensor.routes";
import testChoiceRouter from "./routes/test/test-choice.routes";
import testRouter from "./routes/test/test.routes";
import serialRouter from "./routes/hardware/serial-manager.routes";
import standRouter from "./routes/hardware/stand.routes";
import heatingRouter from "./routes/hardware/heating.routes";
import environmentRouter from "./routes/hardware/environment.routes";
import robotRouter from "./routes/hardware/robot.routes";
import gridtestRouter from "./routes/gridtest/gridtest.routes";
import exportRouter from "./routes/export/export.routes";
import sensorEventsRouter from "./routes/sensor/sensor-events.routes";
import testStepRouter from "./routes/test/test-step.routes";
import masterTestRouter from "./routes/test/master-test.routes";
import telemetryRouter from "./routes/telemetry/telemetry.routes"
import analysisRouter from "./routes/analysis/analysis.routes";
import timingRouter from "./routes/timing/timing.routes";
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });
const serverIP = process.env.SERVER_IP;
console.log("Loaded SERVER_IP:", process.env.SERVER_IP);

const app = express();

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

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/sensors", sensorsRouter);
app.use("/api/testchoice", testChoiceRouter);
app.use("/api/test", testRouter);
app.use("/api/serial", serialRouter);
app.use("/api/stand", standRouter);
app.use("/api/heating", heatingRouter);
app.use("/api/environment", environmentRouter);
app.use("/api/robot", robotRouter);
app.use("/api/gridtest", gridtestRouter);
app.use("/api/export", exportRouter);
app.use("/api", sensorEventsRouter);
app.use("/api/test-steps", testStepRouter);
app.use("/api/master-test", masterTestRouter);
app.use("/api/telemetry", telemetryRouter);
app.use("/api/analysis", analysisRouter);
app.use("/api/timing", timingRouter);

const PORT = Number(process.env.SERVER_PORT ?? 3000);
// Bind to 0.0.0.0 so other devices can reach it
app.listen(PORT, "0.0.0.0", () => {
    console.log(`API listening on http://0.0.0.0:${PORT}`);
});
