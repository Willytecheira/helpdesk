export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

export function actionOk<T>(data?: T): ActionResult<T> {
  return { ok: true, data }
}

// Devuelve ActionResult<never> para ser asignable a cualquier ActionResult<T>.
export function actionError(
  error: string,
  fieldErrors?: Record<string, string>
): ActionResult<never> {
  return { ok: false, error, fieldErrors }
}
