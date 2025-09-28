import { Routes, Route } from "react-router-dom";
import RobotControlCard from "./Pages/RobotControlCard";
import ControlPanel from "./Pages/ControlPanel";


export default function App() {
    return (
        <Routes>
            <Route path="/" element={<RobotControlCard />} />
            <Route path="/controlpanel" element={<ControlPanel />} />
        </Routes>
    );
}
