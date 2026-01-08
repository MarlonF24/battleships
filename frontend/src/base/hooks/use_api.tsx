import { ResponseError, unpackErrorMessage } from "../backend_api.js";
import { useAsync } from "./use_async.js";



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