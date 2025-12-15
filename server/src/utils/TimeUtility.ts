/**
 * TimeUtility - Centralized timing control for simulation speed adjustment
 *
 * This utility provides methods to adjust timing based on SIMULATION_SPEED environment variable.
 * Useful for speeding up tests and simulations during development.
 *
 * Environment Variable:
 * - SIMULATION_SPEED: Multiplier for simulation speed (1, 2, 3, 4, 5, 10)
 *   - 1 = Normal speed (default)
 *   - 2 = 2x faster
 *   - 10 = 10x faster
 *
 * Example:
 * - Normal: 5000ms delay
 * - x2 speed: 2500ms delay
 * - x10 speed: 500ms delay
 */
export class TimeUtility {
  private static speedMultiplier: number | null = null;

  /**
   * Get the simulation speed multiplier from environment
   * Cached after first read for performance
   */
  private static getSpeedMultiplier(): number {
    if (this.speedMultiplier !== null) {
      return this.speedMultiplier;
    }

    const speedEnv = process.env.SIMULATION_SPEED;

    if (!speedEnv) {
      this.speedMultiplier = 1; // Default: normal speed
      return this.speedMultiplier;
    }

    const speed = parseInt(speedEnv, 10);

    // Validate speed multiplier
    const validSpeeds = [1, 2, 3, 4, 5, 10];
    if (isNaN(speed) || !validSpeeds.includes(speed)) {
      console.warn(
        `Invalid SIMULATION_SPEED value: ${speedEnv}. Using default (1). Valid values: ${validSpeeds.join(', ')}`
      );
      this.speedMultiplier = 1;
      return this.speedMultiplier;
    }

    this.speedMultiplier = speed;
    console.log(`Simulation speed multiplier: x${speed}`);
    return this.speedMultiplier;
  }

  /**
   * Adjust a delay duration based on simulation speed
   * @param durationMs - Original duration in milliseconds
   * @returns Adjusted duration in milliseconds
   */
  static adjustDelay(durationMs: number): number {
    const multiplier = this.getSpeedMultiplier();
    const adjusted = Math.max(1, Math.floor(durationMs / multiplier));
    return adjusted;
  }

  /**
   * Delay for a specified duration, adjusted by simulation speed
   * @param durationMs - Original duration in milliseconds
   */
  static async delay(durationMs: number): Promise<void> {
    const adjustedDuration = this.adjustDelay(durationMs);
    return new Promise(resolve => setTimeout(resolve, adjustedDuration));
  }

  /**
   * Adjust an interval duration based on simulation speed
   * @param intervalMs - Original interval in milliseconds
   * @returns Adjusted interval in milliseconds
   */
  static adjustInterval(intervalMs: number): number {
    return this.adjustDelay(intervalMs);
  }

  /**
   * Reset the cached speed multiplier (useful for testing)
   */
  static resetCache(): void {
    this.speedMultiplier = null;
  }

  /**
   * Get current simulation speed multiplier
   */
  static getCurrentSpeed(): number {
    return this.getSpeedMultiplier();
  }
}
