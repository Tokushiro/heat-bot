import { SerialPort } from "serialport";
import { RegexParser } from "@serialport/parser-regex";
import { EventEmitter } from "events";

export class SerialManager extends EventEmitter {
    private static _instance: SerialManager;
    static get instance() {
        if (!this._instance) this._instance = new SerialManager();
        return this._instance;
    }

    private port: SerialPort | null = null;
    private parser: RegexParser | null = null;
    private connecting = false;
    private lastWrite: Promise<void> = Promise.resolve();

    get connected(): boolean {
        return !!this.port?.isOpen;
    }

    async connect(path: string, baudRate = 115200): Promise<void> {
        if (this.connected || this.connecting) return;
        this.connecting = true;

        try {
            // open the port
            await new Promise<void>((resolve, reject) => {
                const p = new SerialPort({ path, baudRate, autoOpen: false });
                p.open((err) => (err ? reject(err) : resolve()));
                this.port = p;
            });

            // parse lines terminated with \n or \r\n
            this.parser = this.port!.pipe(new RegexParser({ regex: /\r?\n/ }));

            // incoming lines
            this.parser.on("data", (line: string | Buffer) => {
                const msg = line.toString().trim();
                if (msg) this.emit("data", msg);
            });

            // lifecycle events
            this.port!.on("close", () => {
                this.emit("status", { connected: false, reason: "close" });
                this.cleanup();
            });

            this.port!.on("error", (e: unknown) => {
                this.emit("status", {
                    connected: false,
                    reason: "error",
                    error: String(e),
                });
                this.cleanup();
            });

            // notify
            this.emit("status", { connected: true });

            // optional handshake
            const ok = await this.verify();
            if (!ok) throw new Error("Handshake failed: no 'conn' echo");
        } finally {
            this.connecting = false;
        }
    }

    async disconnect(): Promise<void> {
        if (!this.port) return;
        await new Promise<void>((resolve) => this.port!.close(() => resolve()));
        this.cleanup();
        this.emit("status", { connected: false, reason: "manual" });
    }

    /** Serialize writes and ensure newline termination. */
    async send(line: string): Promise<void> {
        if (!this.connected || !this.port) throw new Error("Not connected");
        const payload = line.endsWith("\n") ? line : line + "\n";

        this.lastWrite = this.lastWrite.then(
            () =>
                new Promise<void>((resolve, reject) => {
                    this.port!.write(payload, (err) => {
                        if (err) return reject(err);
                        this.port!.drain((err2) => (err2 ? reject(err2) : resolve()));
                    });
                })
        );

        return this.lastWrite;
    }

    /**
     * Send command and wait for JSON response
     * Returns the response line (JSON string)
     */
    async sendCommand(command: string, timeoutMs = 5000): Promise<string> {
        if (!this.connected) throw new Error("Not connected");

        return new Promise((resolve, reject) => {
            let timer: NodeJS.Timeout | null = setTimeout(() => {
                cleanup();
                reject(new Error(`Command timeout: ${command}`));
            }, timeoutMs);

            const onData = (line: string) => {
                // We expect JSON response
                try {
                    const parsed = JSON.parse(line);
                    if (timer) clearTimeout(timer);
                    cleanup();
                    resolve(line);
                } catch {
                    // Not a JSON line, keep waiting
                }
            };

            const cleanup = () => {
                this.off("data", onData);
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
            };

            this.on("data", onData);

            // Send the command
            this.send(command).catch((err) => {
                cleanup();
                reject(err);
            });
        });
    }

    /** Wait until an exact line equals `expected`, or timeout. */
    private waitForLine(expected: string, timeoutMs: number): Promise<boolean> {
        return new Promise((resolve) => {
            let timer: NodeJS.Timeout | null = setTimeout(() => {
                cleanup();
                resolve(false);
            }, timeoutMs);

            const onData = (line: string) => {
                if (line === expected) {
                    if (timer) clearTimeout(timer);
                    cleanup();
                    resolve(true);
                }
            };

            const cleanup = () => {
                this.off("data", onData);
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
            };

            this.on("data", onData);
        });
    }

    private async verify(): Promise<boolean> {
        for (let i = 0; i < 5; i++) {
            try {
                await this.send("conn");
                const ok = await this.waitForLine("conn", 400);
                if (ok) return true;
            } catch {
                // retry
            }
        }
        return false;
    }

    private cleanup() {
        try {
            this.parser?.removeAllListeners();
        } catch {
            // ignore
        }
        this.parser = null;
        this.port = null;
    }
}
