import apiClient from '../config/api';

interface ErrorResponse {
  message: string;
}

export interface GenerateSqlResponse {
  generated_sql: string;
  // Potentially other fields from backend if any
}

export interface DryRunResponse {
  message: string;
  bytes_processed?: number;
  gb_processed?: number;
  // Potentially other fields from backend
}

export const generateSqlFromNaturalLanguage = async (
  connectionId: string,
  userRequest: string,
  objectNames: string[]
): Promise<GenerateSqlResponse> => {
  try {
    const response = await apiClient.post<GenerateSqlResponse>('/generate_sql_from_natural_language', {
      connection_id: connectionId,
      user_request: userRequest,
      object_names: objectNames,
    });
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data) {
      throw error.response.data as ErrorResponse;
    }
    throw { message: error.message || 'Failed to generate SQL query from natural language.' } as ErrorResponse;
  }
};

export const dryRunQuery = async (
  connectionId: string,
  query: string
): Promise<DryRunResponse> => {
  try {
    const response = await apiClient.post<DryRunResponse>('/dry-run', {
      id: connectionId, // Backend /api/dry-run expects 'id' for connection_id
      query: query,
    });
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data) {
      throw error.response.data as ErrorResponse;
    }
    throw { message: error.message || 'Failed to perform dry run of the query.' } as ErrorResponse;
  }
};
