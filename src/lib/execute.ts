// Utility for executing shell commands asynchronously
import { exec } from 'child_process'; // Node.js built-in module for spawning child processes
import { promisify } from 'util'; // Utility to convert callback-based functions to promises

/**
 * Converts child_process.exec to return a Promise
 * @param command - Shell command to execute
 * @param options - Optional execution options
 * @returns Promise resolving with stdout/stderr output
 * @rejects {Error} If command writes to stderr or exits with non-zero code
 */
export const execAsync = promisify(exec);