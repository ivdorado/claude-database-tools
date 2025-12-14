import { vi } from 'vitest';

// Mock query result
export interface MockQueryResult {
  recordset: any[];
  rowsAffected: number[];
}

// Mock request builder
export class MockRequest {
  private inputs: Map<string, any> = new Map();
  private mockQueryResult: MockQueryResult = { recordset: [], rowsAffected: [0] };

  input(name: string, value: any): this {
    this.inputs.set(name, value);
    return this;
  }

  getInputs(): Map<string, any> {
    return this.inputs;
  }

  setMockResult(result: MockQueryResult): void {
    this.mockQueryResult = result;
  }

  async query(sql: string): Promise<MockQueryResult> {
    // Store the query for inspection
    (this as any).lastQuery = sql;
    return this.mockQueryResult;
  }

  async execute(procedureName: string): Promise<MockQueryResult & { returnValue: number }> {
    (this as any).lastProcedure = procedureName;
    return { ...this.mockQueryResult, returnValue: 0 };
  }
}

// Track created requests for assertions
export const mockRequests: MockRequest[] = [];

// Create mock sql module
export const createMockSql = () => {
  const Request = vi.fn().mockImplementation(() => {
    const req = new MockRequest();
    mockRequests.push(req);
    return req;
  });

  return {
    Request,
    connect: vi.fn().mockResolvedValue({ connected: true }),
    close: vi.fn().mockResolvedValue(undefined),
    NVarChar: vi.fn(),
    Int: vi.fn(),
    Bit: vi.fn(),
  };
};

// Reset mocks between tests
export const resetMocks = () => {
  mockRequests.length = 0;
};

// Set mock result for next request
export const setNextQueryResult = (result: MockQueryResult) => {
  MockRequest.prototype.query = vi.fn().mockResolvedValue(result);
};

// Set mock to throw error
export const setQueryError = (error: Error) => {
  MockRequest.prototype.query = vi.fn().mockRejectedValue(error);
};
