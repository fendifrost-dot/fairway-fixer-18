/**
 * Alias entrypoint — same behavior as cross-project-api (Fendi Control Hub historically called this name).
 */
import { handleCreditGuardianRequest } from "../_shared/creditGuardianApi.ts";

Deno.serve(handleCreditGuardianRequest);
