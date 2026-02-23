/**
 * Terminal Health Check Utility
 * 
 * Provides health check functionality for the ttyd terminal service
 * before attempting to load it in an iframe.
 */

export interface HealthCheckResult {
  accessible: boolean;
  responseTime?: number;
  statusCode?: number;
  error?: string;
  serverInfo?: {
    server: string;
    contentType: string;
  };
}

/**
 * Check if the terminal service is healthy and accessible
 * 
 * @param url - The terminal service URL
 * @param timeout - Timeout in milliseconds (default: 5000)
 * @returns Health check result with detailed information
 */
export async function checkTerminalHealth(
  url: string,
  timeout: number = 5000
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Perform HEAD request to check service availability
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-cache',
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;
    const serverHeader = response.headers.get('server') || '';
    const contentType = response.headers.get('content-type') || '';

    // Check if response indicates ttyd service
    const isTtydService = serverHeader.toLowerCase().includes('ttyd') ||
                          serverHeader.toLowerCase().includes('gotty');

    if (!response.ok) {
      return {
        accessible: false,
        responseTime,
        statusCode: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`,
        serverInfo: {
          server: serverHeader,
          contentType,
        },
      };
    }

    if (!isTtydService) {
      console.warn('[HealthCheck] Server may not be ttyd:', serverHeader);
    }

    return {
      accessible: true,
      responseTime,
      statusCode: response.status,
      serverInfo: {
        server: serverHeader,
        contentType,
      },
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const err = error instanceof Error ? error : new Error('Unknown error');

    let errorMessage = err.message;
    let errorCode: string | undefined;

    // Handle specific error types
    if (err.name === 'AbortError') {
      errorMessage = `Connection timeout after ${timeout}ms`;
      errorCode = 'TIMEOUT';
    } else if (err.message.includes('Failed to fetch')) {
      errorMessage = 'Connection refused - service may not be running';
      errorCode = 'ECONNREFUSED';
    } else if (err.message.includes('NetworkError')) {
      errorMessage = 'Network error - check your connection';
      errorCode = 'NETWORK_ERROR';
    }

    return {
      accessible: false,
      responseTime,
      error: errorMessage,
    };
  }
}

/**
 * Perform a quick ping to check if service is responding
 * 
 * @param url - The terminal service URL
 * @returns True if service responds within 2 seconds
 */
export async function quickPing(url: string): Promise<boolean> {
  try {
    const result = await checkTerminalHealth(url, 2000);
    return result.accessible;
  } catch {
    return false;
  }
}

/**
 * Wait for terminal service to become available
 * 
 * @param url - The terminal service URL
 * @param maxAttempts - Maximum number of attempts (default: 10)
 * @param delayMs - Delay between attempts in milliseconds (default: 1000)
 * @returns True if service becomes available, false if max attempts reached
 */
export async function waitForTerminal(
  url: string,
  maxAttempts: number = 10,
  delayMs: number = 1000
): Promise<boolean> {
  console.log(`[HealthCheck] Waiting for terminal service at ${url}...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[HealthCheck] Attempt ${attempt}/${maxAttempts}`);

    const result = await checkTerminalHealth(url, 3000);

    if (result.accessible) {
      console.log(`[HealthCheck] Terminal service is available (${result.responseTime}ms)`);
      return true;
    }

    if (attempt < maxAttempts) {
      console.log(`[HealthCheck] Service not available, retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.error('[HealthCheck] Terminal service did not become available');
  return false;
}

/**
 * Get detailed diagnostics about the terminal service
 * 
 * @param url - The terminal service URL
 * @returns Diagnostic information
 */
export async function getTerminalDiagnostics(url: string): Promise<{
  health: HealthCheckResult;
  recommendations: string[];
}> {
  const health = await checkTerminalHealth(url);
  const recommendations: string[] = [];

  if (!health.accessible) {
    if (health.error?.includes('timeout')) {
      recommendations.push('Service is slow to respond - check container resources');
      recommendations.push('Verify network connectivity');
    } else if (health.error?.includes('refused')) {
      recommendations.push('Container may not be running - run: docker-compose up kali-pentest');
      recommendations.push('Check port mapping in docker-compose.yml');
      recommendations.push('Verify firewall settings');
    } else {
      recommendations.push('Check Docker container logs: docker logs kali-pentest');
      recommendations.push('Verify ttyd service is running inside container');
    }
  } else if (health.responseTime && health.responseTime > 1000) {
    recommendations.push('Service is responding slowly - check container performance');
  }

  return {
    health,
    recommendations,
  };
}
