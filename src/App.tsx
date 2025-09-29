import { Routes, Route } from "react-router-dom";
import RobotControlCard from "./Pages/RobotControlCard";
import ControlPanel from "./Pages/ControlPanel";
import TestingPatter1 from "./Pages/TestingPattern1";


export default function App() {
    return (
        <Routes>
            <Route path="/" element={<RobotControlCard />} />
            <Route path="/controlpanel" element={<ControlPanel />} />
            <Route path="/testingpattern1" element={<TestingPatter1/>} />
        </Routes>
    );
}
