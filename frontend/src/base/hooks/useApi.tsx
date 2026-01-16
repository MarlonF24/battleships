import { ResponseError, unpackErrorMessage } from "../api";
import { useAsync } from "./useAsync.js";



function defaultResponseErrorHandler(error: ResponseError, message: string) {
    throw new Error(`API Error: ${message}`);
}


export const useApi = (responseErrorHandler: (error: ResponseError, message: string) => void = defaultResponseErrorHandler) => {
  const { loading, error, execute } = useAsync(); 
  
  async function executeApi<T>(apiCall: () => Promise<T>): Promise<T> {
    return execute(async () => {
      try {
        return await apiCall();
      } catch (error) {
        if (error instanceof ResponseError) {
          const message = await unpackErrorMessage(error);
          responseErrorHandler(error, message);
        }
        throw error; // Re-throw for useAsync to handle
      }
    });
  };
  
  return { loading, error, executeApi };
};