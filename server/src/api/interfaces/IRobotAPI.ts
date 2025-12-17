import { EventEmitter } from "events";

export interface Position {
    x: number;
    y: number;
    angle: number;
}

export interface MovementResult {
    success: boolean;
    position: Position;
    duration: number;
    error?: string;
}

/**
 * Interface for Robot API - both real and mock implementations must follow this contract
 */
export interface IRobotAPI extends EventEmitter {
    /**
     * Initialize robot - establish connection and home position
     */
    initialize(): Promise<boolean>;

    /**
     * Home the robot to origin
     */
    homeRobot(): Promise<MovementResult>;

    /**
     * Move to absolute Cartesian position (alias for moveTo)
     */
    moveCartesian(x: number, y: number, speed?: number): Promise<MovementResult>;

    /**
     * Move to absolute Cartesian position
     */
    moveTo(x: number, y: number, speed?: number): Promise<MovementResult>;

    /**
     * Move in polar coordinates (angle and distance from origin)
     */
    movePolar(angle: number, distance: number, speed?: number): Promise<MovementResult>;

    /**
     * Move tangentially (circular arc around sensor)
     */
    moveTangential(angle: number, radius: number, speed?: number): Promise<MovementResult>;

    /**
     * Move radially (toward or away from sensor)
     */
    moveRadial(
        startDistance: number,
        endDistance: number,
        angle: number,
        speed?: number
    ): Promise<MovementResult>;

    /**
     * Perform tangential boundary test
     */
    performTangentialBoundaryTest(
        radius: number,
        startAngle: number,
        endAngle: number,
        angleStep?: number,
        speed?: number
    ): Promise<Position[]>;

    /**
     * Perform radial boundary test
     */
    performRadialBoundaryTest(
        angle: number,
        distances: number[],
        speed?: number
    ): Promise<Position[]>;

    /**
     * Stop all movement immediately
     */
    stopMovement(): Promise<void>;

    /**
     * Get current robot position
     */
    getCurrentPosition(): Promise<Position>;

    /**
     * Check if robot is currently moving
     */
    isRobotMoving(): boolean;
}
