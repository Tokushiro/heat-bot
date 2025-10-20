import express from "express";
import cors from "cors";
import sensorsRouter from "./routes/sensor_routes";

const app = express();

app.use(cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
    allowedHeaders: ["Content-Type","Authorization"],
    credentials: true,
}));

app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/sensors", sensorsRouter);

const PORT = Number(process.env.SERVER_PORT ?? 3000);
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
