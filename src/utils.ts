type Result<T> = { success: true; data: T } | { success: false; error: Error };

export async function promiseResolver<T>(prom: Promise<T>): Promise<Result<T>> {
  try {
    const result = await prom;

    return { success: true, data: result };
  } catch (error: unknown) {
    const normalizedError =
      error instanceof Error ? error : new Error(String(error));

    return { success: false, error: normalizedError };
  }
}
