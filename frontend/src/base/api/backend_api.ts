declare global {
    interface Window {
        BACKEND_HOST: string;
    }
}


import { DefaultApi, Configuration, ResponseError } from "./api-client";

export async function unpackErrorMessage(error: ResponseError): Promise<string> {
    const response = await error.response.json();
    const detail = response.detail instanceof Array ? response.detail[0] : response.detail;
    const message = typeof detail === "string" ? detail : detail.msg;
    return error.response.status + ": " + message;
}

const BACKEND_HOST = import.meta.env.VITE_BACKEND_ADDRESS ?? window.location.host;


window.BACKEND_HOST = BACKEND_HOST;
console.debug(`Using backend host: ${BACKEND_HOST}`);
export const api = new DefaultApi(new Configuration({ basePath: `http://${BACKEND_HOST}` }));







