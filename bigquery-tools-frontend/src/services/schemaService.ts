import apiClient from '../config/api';

export interface FieldSchema {
  name: string;
  field_type: string; // Or use a more specific enum/type if available from BQ
}

export interface TableSchemaResponse {
  schema: FieldSchema[];
  // Potentially include other details like table description if API provides it
}

export interface FieldDescriptionUpdate {
  field_name: string;
  field_description: string;
}

interface UpdateSchemaResponse {
  message: string;
  object_id?: string; // As returned by the backend
}

interface ErrorResponse {
  message: string;
}

export const getTableSchema = async (connectionId: string, objectName: string): Promise<TableSchemaResponse> => {
  try {
    const response = await apiClient.post<TableSchemaResponse>('/table_schema', {
      connection_id: connectionId,
      object_name: objectName,
    });
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data) {
      throw error.response.data as ErrorResponse;
    }
    throw { message: error.message || 'Failed to fetch table schema.' } as ErrorResponse;
  }
};

// Interfaces for getAllSavedSchemas
export interface SavedField {
  id: string;
  field_name: string;
  field_description: string | null;
}

export interface SavedObject {
  id: string;
  connection_id: string;
  object_name: string;
  object_description: string | null;
  fields: SavedField[];
}

export const getAllSavedSchemas = async (): Promise<SavedObject[]> => {
  try {
    const response = await apiClient.get<SavedObject[]>('/objects_with_fields');
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data) {
      throw error.response.data as ErrorResponse;
    }
    throw { message: error.message || 'Failed to fetch saved schemas.' } as ErrorResponse;
  }
};

export const updateSchemaDescription = async (
  connectionId: string,
  objectName: string,
  objectDescription: string | null | undefined, // Can be optional
  fields: FieldDescriptionUpdate[]
): Promise<UpdateSchemaResponse> => {
  try {
    const payload: any = {
      connection_id: connectionId,
      object_name: objectName,
      fields: fields,
    };
    if (objectDescription !== undefined && objectDescription !== null) { // Send only if provided
      payload.object_description = objectDescription;
    }
    const response = await apiClient.post<UpdateSchemaResponse>('/table_schema_update', payload);
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data) {
      throw error.response.data as ErrorResponse;
    }
    throw { message: error.message || 'Failed to update schema description.' } as ErrorResponse;
  }
};
