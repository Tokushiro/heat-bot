import express from "express";
import cors from "cors";
import sensorsRouter from "./routes/sensors";

const app = express();
app.use(express.json());

app.use(cors());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/sensors", sensorsRouter);

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
});
