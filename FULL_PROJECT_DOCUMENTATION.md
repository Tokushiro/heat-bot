# HeatBot – Project Documentation

This document explains how the HeatBot system is assembled, how data moves through it, and how the IEC 63180 style tests (boundary, tangential, radial) are executed. Paths are workspace relative.

## 1. High-Level Architecture
- **Server (`server/`)**: Node.js/Express API backed by PostgreSQL. Central orchestration, persistence, telemetry, exports, and analysis.
- **Client (`client/`)**: React + Vite UI that drives tests, streams live events (Server-Sent Events), visualizes boundaries and compliance results, and triggers exports.
- **Sensor Gateway (`sensor/ble_gateway.py`)**: Python BLE scanner (Bleak) that decodes PIR events from a specific MAC and posts them to the server.
- **Environment & mocks**: `.env.example` (root) and `server/.env.example` toggle real vs. mock hardware (`USE_MOCK_*` flags) and set addresses such as `SERVER_IP`, `BLE_SENSOR_MAC`, `ROBOT_SERIAL_PORT`.

## 2. Data Flow Overview
1. **Detection source**  
   - *Real*: BLE gateway decodes advertisement payload bit (byte 51 bit 4) and POSTs `/api/sensor-events` with `sensorId/mac/raw/timestamp` (Python `send_event_to_heatbot` in `sensor/ble_gateway.py`).  
   - *Mock*: Sensor simulation emits detections based on configured zones and robot position (see §4.3).
2. **Server ingestion**  
   - `server/src/routes/sensor/sensor-events.routes.ts` → `SensorEventsController.handleSensorEvent` → `SensorEventsService.processSensorEvent` pushes events onto `sensorEventBus`.
   - Real sensor adapter (`RealSensorAPI`) listens to `bleEventBus` for detection events when running hardware mode.
3. **Test orchestration**  
   - `MasterTestOrchestrator` (server) subscribes to `bleEventBus` and buffers detections during each movement step. Movements are executed through the robot API (real or mock).
4. **Persistence & telemetry**  
   - Test metadata in `test` table, per-step rows in `test_step`, latest aggregate in `test_state`, telemetry in `telemetry_sample` via `TelemetryService`.
5. **Frontend**  
   - React hook `useMasterTest` opens SSE to `/api/master-test/stream` and receives events (`test_started`, `boundary_detection_completed`, `phase_progress`, `movement_completed`, etc.). UI pages render progress, plots, and exports.

## 3. Server Structure
- **Entry**: `server/src/index.ts` sets CORS (includes `SERVER_IP`), JSON middleware, and mounts routers (sensors, tests, hardware, exports, analysis, telemetry, timing).
- **Database**: `server/src/db_conn.ts` initializes a `pg` pool from `.env` and logs connectivity once.
- **Routing**: Each folder under `server/src/routes` mirrors a controller namespace (e.g., `master-test.routes.ts`, `sensor-events.routes.ts`, `export.routes.ts`).
- **Models**: Lightweight TS types in `server/src/models` mirror DB tables (`test`, `test_step`, `sensor`, etc.).

### 3.1 Hardware Abstraction
- **Robot API** (`server/src/api/interfaces/IRobotAPI.ts`): Contract for movement primitives (cartesian/polar/tangential/radial), boundary helpers, and status.
- **Sensor API** (`server/src/api/interfaces/ISensorAPI.ts`): Contract for initialization, detection, status, and configuration of PIR sensors.
- **Factories**: `RobotAPIFactory` and `SensorAPIFactory` pick real vs. mock implementations based on `USE_MOCK_ROBOT` / `USE_MOCK_SENSOR`. They also forward low-level events to the telemetry bus.
- **Real implementations**:
  - `RealRobotAPI` talks to the controller through `SerialManager` (line-based protocol, queueing, handshake `"handshake"`/`"handshake_ok"`, and explicit commands like `moveto`, `home`, `stop`).
  - `RealSensorAPI` listens to `bleEventBus` for detection events produced by the BLE gateway endpoint.
- **Mock implementations**:
  - `MockRobotAPI` simulates timing (0.5 m/s default), queues movements, and logs all target positions.
  - `MockSensorAPI` defines probabilistic detection zones (front/right/back/left) with distance and angle bounds; detection probability is reduced by distance, ambient temperature variance, humidity variance, and extra randomness near boundaries. It emits to `bleEventBus` to mimic real sensor traffic.
  - `RobotSensorIntegration` links robot movement completions to mock sensor checks so detections are automatically produced when the mock robot moves.

### 3.2 Core Services
- **SerialManager** (`server/src/services/core/SerialManager.ts`): Opens and verifies the serial port, serializes writes, parses line-delimited responses, and exposes `"data"`/`"status"` events. Used by real robot/heating/stand services.
- **TelemetryService**: Stores samples (`telemetry_sample`), broadcasts via `TelemetryEventBus`, and can export CSV. Used during detection steps to capture robot position, detection flag, and environmental metrics.
- **SensorEventsService**: Minimal ingress for BLE gateway; validates payload and emits to `sensorEventBus` for SSE clients.
- **TestService/TestStepService/TestStateService**: CRUD helpers for `test`, `test_step`, and `test_state` tables, including summary aggregation.
- **Export services**: `IECExportService` (CSV) and `ExcelTemplateService` (Excel) assemble boundary/grid/radial datasets into IEC-style reports.
- **Analysis**: `StatisticalAnalysisService` (used by `AnalysisController`) compares tests, computes angular statistics, probability curves, correlations, and outliers for boundary measurements.

## 4. Master Test Orchestration (IEC 63180 style)
The orchestrator (`server/src/services/test/MasterTestOrchestrator.ts`) is the single state machine driving all phases. It emits events consumed by the frontend SSE stream.

### 4.1 State machine
- States: `IDLE`, `BOUNDARY_RUNNING/PAUSED/COMPLETE`, `TANGENTIAL_RUNNING/PAUSED/COMPLETE`, `RADIAL_RUNNING/PAUSED/COMPLETE`, `ALL_COMPLETE`, `ERROR`.
- Transitions are validated (e.g., tangential/radial cannot start before boundary completes).
- Pausing sets state to `*_PAUSED`, stops robot movement, and persists position/state.

### 4.2 Detection buffering
- `bleEventBus` listener caches `DetectionEvent` objects (detected flag, timestamp, raw payload) while a test step is active (`currentStepId` set).
- When buffering, each detection is also stored as telemetry with the current robot position, allowing later reconstruction of when detections fired during a movement.

### 4.3 Boundary Detection (Tangential stepped approach)
Parameters: 36 angles (0–350 deg, 10 deg step), start distance 8.0 m, step size 0.5 m toward the sensor, minimum distance 1.0 m.

Algorithm per angle:
1. Emit `boundary_step_started` with start/min distances and step.
2. While `currentDistance >= min`:
   - Execute tangential movement at the current radius: `testTangentialPosition(step_type='BOUNDARY_DETECTION_STEPPED')`.
   - Movement flow:
     - Insert a `test_step` row with `distance_1=currentDistance`, `angle`, `step_type`, and start timestamps.
     - Calculate cartesian target `(x, y)` for the polar coordinate.
     - Move via `RobotAPIFactory.getInstance().moveTangential(angle, distance, speed)`.
     - Wait `detection_wait_time` (default 2000 ms), collect buffered detections, and set `detection_1`/`detection_2` (repeat count default 2). `detection_final` is OR of attempts.
   - Emit `boundary_step_completed` and `movement_completed` with success/detected flags.
   - If any detection occurs, set `detection_boundary` to the current distance (the farthest distance with detection), record `detected_distance` (first detection) and `no_detection_distance` (largest miss), emit `boundary_found_at_angle`, and break; otherwise, decrement distance by 0.5 m and repeat.
3. Persist boundary result to `test_state.boundary_results`, increment progress, save state, emit `phase_progress`.
4. After all angles, transition to `BOUNDARY_COMPLETE`, update test status to `PAUSED`, and emit `boundary_detection_completed` with all `BoundaryResult` entries.

### 4.4 Tangential Grid Test (Compliance surface)
Purpose: map detection coverage over a plane with tangential motion.
- Grid generation: `generateGridCells(cellSize=0.5 m, maxRadius=6.0 m)` creates Cartesian cells in a square grid, skips origin, filters radius > 0.1 m and <= 6 m, sorts by radius then angle.
- For each cell `(x, y, row, col)`:
  - Insert `test_step` with `step_type='GRID_TANGENTIAL'`, polar `angle/radius`, and cell indices.
  - Move via `moveCartesian(x, y)` at configured speed (default 50 units ≈ 0.5 m/s).
  - Wait `detection_wait_time` and evaluate buffered detections for two attempts; set `detection_final` accordingly.
  - Emit `measurement_completed` and `compliance_measurement_completed` with coordinates and detection flag; update progress.
- Emits `tangential_test_completed` at the end and updates `tangential_results_count`.

### 4.5 Radial Compliance Test
Purpose: verify detection just inside/outside the measured boundary.
- Derives angles from boundary results that actually have a `detection_boundary`.
- Offsets tested per angle: [-2.0 m, -1.0 m, +1.0 m, +2.0 m] relative to the boundary distance.
- For each `(angle, offset)`:
  - Compute target distance `boundaryDistance + offset`.
  - Insert `test_step` with `step_type='COMPLIANCE_RADIAL'`, `distance_1=targetDistance`, `distance_2=offset`.
  - Move radially using `movePolar(angle, distance)`, wait for detection, set `detection_final` from two attempts.
  - Emit `compliance_measurement_completed` and `phase_progress`; update `radial_results_count`.
- Emits `radial_test_completed` when done.

### 4.6 Persistence and Events
- **Persistence**: Each step is stored in `test_step`; aggregate state saved in `test_state` (JSON field `state_data` plus `boundary_results` array). `TestService` updates `test.status` (`IN_PROGRESS`, `PAUSED`, `COMPLETED`, `ERROR`).
- **Events**: Orchestrator emits granular events consumed by SSE and telemetry:
  - Lifecycle: `test_started`, `phase_completed_awaiting_next`, `test_completed`, `test_failed`, `test_paused`, `test_resumed`, `test_stopped`.
  - Boundary: `boundary_step_started`, `boundary_step_completed`, `boundary_found_at_angle`, `boundary_detection_completed`.
  - Movement/measurement: `movement_started`, `movement_completed`, `measurement_completed`, `compliance_measurement_completed`, `phase_progress`, `position_updated`, `detection`.

## 5. Sensor Gateway (Python)
- File: `sensor/ble_gateway.py`.
- Loads `.env` from project root; key envs: `NIKO_PIR_MAC`, `SERVER_IP`, `HEATBOT_EVENTS_ENDPOINT` (default `/api/sensor-events`), `HEATBOT_SENSOR_ID`.
- Uses `BleakScanner` to subscribe to advertisement packets. For the configured MAC, it:
  - Extracts manufacturer payload, checks length ≥ 52 bytes.
  - Reads byte index 51, bit 4 (mask `(b >> 3) & 0x01`) to determine PIR flag.
  - On PIR = 1, POSTs JSON `{sensorId, mac, event:"MovementDetected", raw: hex, timestamp}` to the server.
- Runs continuously with `asyncio`, printing detections and gateway status.

## 6. Client Application
- Entry: `client/src/App.tsx` with routes for robot control, control panel, IEC test (`TestingPattern1`), history, manual control, and serial test.
- **API wrapper**: `Components/apiAxios` sets the base URL; all requests hit the server REST endpoints.
- **SSE + orchestration**: `Hooks/useMasterTest` manages SSE connection to `/api/master-test/stream`, holds execution state, boundary/tangential/radial datasets, and exposes actions (`startTest`, `startTestPhase`, `pause/resume/stop`, `loadTestHistory`).
- **Testing UI** (`Pages/TestingPattern1.tsx`):
  - Presents phase cards (boundary, tangential, radial) with status, progress, and stats.
  - Displays boundary tables/plots (`BoundaryComparisonPlot`, `PolarPlot`) overlaying ideal vs. measured boundaries.
  - Supports CSV/JSON exports of boundary and compliance results.
  - Lets user choose the next phase once boundary detection finishes (modal driven by SSE events).
- **History UI** (`Pages/HistoryPage.tsx`): Fetches tests, their stored `boundary_results`, and compliance steps for replay/exports.
- **Visualization components**: `PolarPlot` and `BoundaryComparisonPlot` draw ideal boundary circles and measured boundaries; tangential grid results are shown via cards/tables.

## 7. Database Footprint (inferred from models/services)
- `sensor`: static metadata (name, manufacturer, mounting height, etc.).
- `test`: top-level record with `test_id`, `test_choice`, `sensor_id`, dates, and status.
- `test_step`: per-measurement rows with angle, distances, detection flags, cell indices, status, and timestamps.
- `test_state`: latest aggregate state (current phase, boundary_results JSON, last position, completion counters).
- `telemetry_sample`: time-series environment/heating/robot/detection samples.
- Additional views/tables for analysis/exports (e.g., `radial_boundary`, `v_latest_telemetry`, `v_telemetry_summary`) referenced by services.

## 8. Exports and Analysis
- **Exports**: `ExportController` provides endpoints for boundary/grid/radial CSV and Excel. `IECExportService` calculates verdict radius/diameter, failure counts, and angular summaries; `ExcelTemplateService` builds multi-sheet reports with overview, tangential grid heatmaps, and boundary graphs.
- **Analysis**: `AnalysisController` exposes endpoints to compute angular statistics, detection probability curves, test comparisons, trend analysis, and outlier detection using `StatisticalAnalysisService`.

## 9. Typical Test Run (IEC)
1. Client calls `POST /api/master-test/start` with `{ test_id, sensor_id, test_type: 'FULL', ...optional speeds/waits/repeats }`.
2. Orchestrator initializes robot/sensor, enables mock integration if configured, and starts boundary detection (SSE `test_started`).
3. For each angle, robot moves tangentially inward until detection; results stream via SSE. Completion emits `boundary_detection_completed` with all boundaries.
4. User picks next phase (tangential grid or radial compliance) via UI; client calls `POST /api/master-test/start-phase`.
5. Orchestrator executes chosen phase, emitting progress and measurements.
6. After both tangential and radial phases, state moves to `ALL_COMPLETE`, `test.status` set to `COMPLETED`, and exports become available.

## 10. Configuration Notes
- Toggle mocks in `.env` / `server/.env`: set `USE_MOCK_ROBOT`/`USE_MOCK_SENSOR`/`USE_MOCK_STAND`/`USE_MOCK_HEATING`/`USE_MOCK_ENVIRONMENT`/`USE_MOCK_GRIDTEST` to `"false"` to engage real hardware.
- `SIMULATION_SPEED` can accelerate mock timings (multiplier for waits/delays).
- `SERVER_IP` is used both by server CORS and Python gateway to reach the API; ensure it matches your LAN IP when testing across devices.

## 11. Key Files (by purpose)
- **Entry & config**: `server/src/index.ts`, `.env.example`, `server/.env.example`.
- **Orchestration**: `server/src/services/test/MasterTestOrchestrator.ts`, controllers/routes in `server/src/controllers/test` and `server/src/routes/test`.
- **Hardware abstraction**: `server/src/api/interfaces`, `server/src/api/implementations/{real,mock}`, `server/src/api/factories/*`.
- **Detection bus**: `server/src/services/core/BleEventBus.ts`, `server/src/services/core/SensorEventsService.ts`.
- **Telemetry**: `server/src/services/telemetry/TelemetryService.ts`.
- **Exports**: `server/src/services/export/*`, `server/src/controllers/export/ExportController.ts`.
- **Analysis**: `server/src/services/analysis/StatisticalAnalysisService.ts`, `server/src/controllers/analysis/AnalysisController.ts`.
- **Client orchestration UI**: `client/src/Hooks/useMasterTest.tsx`, `client/src/Pages/TestingPattern1.tsx`, `client/src/Components/BoundaryComparisonPlot.tsx`, `client/src/Components/PolarPlot.tsx`.
- **Sensor gateway**: `sensor/ble_gateway.py`.

