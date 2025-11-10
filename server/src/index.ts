import express from "express";
import cors from "cors";
import sensorsRouter from "./routes/sensor_routes";
import testChoiceRouter from "./routes/test_choice_rotues";
import testRouter from "./routes/test_routes";
import serialRouter from "./routes/serial_manager_routes";
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

const PORT = Number(process.env.SERVER_PORT ?? 3000);
// Bind to 0.0.0.0 so other devices can reach it
app.listen(PORT, "0.0.0.0", () => {
    console.log(`API listening on http://0.0.0.0:${PORT}`);
});
