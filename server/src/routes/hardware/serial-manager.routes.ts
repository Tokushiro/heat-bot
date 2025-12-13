import { Router } from "express";
import {
    connectSerial,
    disconnectSerial,
    sendSerial,
    getSerialStatus,
    serialStream,
} from "../../controllers/hardware/SerialManagerController";

const router = Router();

router.post("/connect", connectSerial);
router.post("/disconnect", disconnectSerial);
router.post("/send", sendSerial);
router.get("/status", getSerialStatus);
router.get("/stream", serialStream);

export default router;