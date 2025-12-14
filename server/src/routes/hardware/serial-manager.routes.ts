import { Router } from "express";
import {
    connectSerial,
    disconnectSerial,
    sendSerial,
    getSerialStatus,
    serialStream,
    listSerialPorts,
    getMockMode,
} from "../../controllers/hardware/SerialManagerController";

const router = Router();

router.post("/connect", connectSerial);
router.post("/disconnect", disconnectSerial);
router.post("/send", sendSerial);
router.get("/status", getSerialStatus);
router.get("/stream", serialStream);
router.get("/ports", listSerialPorts);
router.get("/mock-mode", getMockMode);

export default router;