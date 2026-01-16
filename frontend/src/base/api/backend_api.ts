declare global {
    interface Window {
        BACKEND_ORIGIN: string;
    }
}


import { DefaultApi, Configuration, ResponseError } from "./api-client";

export async function unpackErrorMessage(error: ResponseError): Promise<string> {
    const response = await error.response.json();
    const detail = response.detail instanceof Array ? response.detail[0] : response.detail;
    const message = typeof detail === "string" ? detail : detail.msg;
    return error.response.status + ": " + message;
}

const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN ?? window.location.origin;

window.BACKEND_ORIGIN = BACKEND_ORIGIN;

export const api = new DefaultApi(new Configuration({ basePath: `http://${BACKEND_ORIGIN}` }));







