import { DefaultApi, Configuration } from "./api-client/index";
export { ResponseError } from "./api-client/index";

const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN ?? window.location.origin;

export const api = new DefaultApi(new Configuration({ basePath: `http://${BACKEND_ORIGIN}` }));
