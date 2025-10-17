import express from "express";
import sensorsRouter from "./routes/sensor_routes";

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/sensors", sensorsRouter);

const PORT = Number(process.env.SERVER_PORT ?? 3000);
app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
});
