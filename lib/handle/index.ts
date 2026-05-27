// lib/handle — handle namespace rules (format, reserved set) and the parent
// domain. Pure and dependency-free so both the React app and the Pages
// Functions can share one source of truth.

export {
  PX_REGISTRY_DOMAIN,
  HANDLE_MIN,
  HANDLE_MAX,
  HANDLE_PATTERN,
  RESERVED_HANDLES,
} from "./constants.ts";
export { validateHandle, type HandleValidation } from "./validate.ts";
