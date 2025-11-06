import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const PC_LAN_IP = process.env.SERVER_IP;

console.log("Loaded SERVER_IP:", process.env.SERVER_IP);

export default defineConfig({
    plugins: [react()],
    server: {
        host: true,  // 0.0.0.0 — so your phone can reach Vite
        port: 5173,
        proxy: {
            "/api": {
                target: `http://${PC_LAN_IP}:3000`,
                changeOrigin: true,
            },
        },
    },
});
