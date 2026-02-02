
import { DefaultApi, Configuration, ResponseError } from "./api-client";

export async function unpackErrorMessage(error: ResponseError): Promise<string> {
    const response = await error.response.json();
    const detail = response.detail instanceof Array ? response.detail[0] : response.detail;
    const message = typeof detail === "string" ? detail : detail.msg;
    return error.response.status + ": " + message;
}

const ENV_BACKEND_ADDRESS = import.meta.env.VITE_BACKEND_ADDRESS;

const BACKEND_HOST = ENV_BACKEND_ADDRESS ?? window.location.host;

if (window.location.protocol === "https:") {
    console.warn("connecting to backend over HTTPS. Make sure this is a proxy server that will forward HTTP to the backend!");
}

const BACKEND_ORIGIN = `${window.location.protocol}//${BACKEND_HOST}`;


console.debug(`Using backend origin: ${BACKEND_ORIGIN}`);
export const api = new DefaultApi(new Configuration({ basePath: BACKEND_ORIGIN }));






