import { OperationResult } from '../core/types.js';

export function formatOutput(result: OperationResult): void {
  // Always output JSON for easy parsing by skill
  console.log(JSON.stringify(result, null, 2));

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}
