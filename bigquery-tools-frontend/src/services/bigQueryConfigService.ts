import apiClient from '../config/api';

export interface BigQueryConfigItem {
  id: string;
  connection_name: string;
  // Add other relevant fields if returned by backend, e.g., created_at
  // For example, if backend returns user_id, gcp_key_json (likely not needed for list view)
}

interface AddConfigResponse extends BigQueryConfigItem {
  message: string;
  // Backend might return the full object or just id/message.
  // Ensuring 'id' and 'connection_name' are part of AddConfigResponse if they are to be used from it.
}

interface TestConfigResponse {
  message: string;
}

interface ErrorResponse {
  message: string;
}

export const getConfigs = async (): Promise<BigQueryConfigItem[]> => {
  try {
    // Assuming the backend returns an array of objects directly,
    // each conforming to at least { id: string, connection_name: string }
    const response = await apiClient.get<BigQueryConfigItem[]>('/config');
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data) {
      throw error.response.data as ErrorResponse;
    }
    throw { message: error.message || 'Failed to fetch configurations.' } as ErrorResponse;
  }
};

export const addConfig = async (connectionName: string, gcpKeyJson: object): Promise<AddConfigResponse> => {
  try {
    const response = await apiClient.post<AddConfigResponse>('/config', {
      connection_name: connectionName,
      gcp_key_json: gcpKeyJson,
    });
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data) {
      throw error.response.data as ErrorResponse;
    }
    throw { message: error.message || 'Failed to add configuration with JSON key.' } as ErrorResponse;
  }
};

export const addConfigFile = async (connectionName: string, gcpKeyFile: File): Promise<AddConfigResponse> => {
  const formData = new FormData();
  formData.append('connection_name', connectionName);
  formData.append('gcp_key_file', gcpKeyFile);

  try {
    const response = await apiClient.post<AddConfigResponse>('/config', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data) {
      throw error.response.data as ErrorResponse;
    }
    throw { message: error.message || 'Failed to add configuration with key file.' } as ErrorResponse;
  }
};

export const testConfig = async (configId: string): Promise<TestConfigResponse> => {
  try {
    const response = await apiClient.post<TestConfigResponse>('/config_test', { id: configId });
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data) {
      throw error.response.data as ErrorResponse;
    }
    throw { message: error.message || 'Failed to test configuration.' } as ErrorResponse;
  }
};
